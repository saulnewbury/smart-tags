// services/addNote.ts

import type { CreateNoteParams, StoreState, Topic, NoteSummary } from '../types'
import { uid, loadSummaries } from '../utils/storage'
import {
  normalizeTagName,
  resolveTopicByName,
  labelEmbeddingText
} from '../utils/textProcessing'
import {
  cosineSimilarity,
  averageVectors,
  topicPrototype
} from '../utils/vectorMath'
import { summarizeToJSON, embedText } from '../utils/openai'

export interface CreateNoteParams {
  transcript: string
  userPrompt: string
  segments?: any[]
  videoId?: string
  originalUrl?: string
  videoTitle?: string
}

// Cluster size management constants
const SOFT_CAP_START = 6 // Start raising threshold after 6 notes
const HARD_CAP = 10 // Hard limit - evict outliers after this
const BASE_THRESHOLD = 0.56 // Normal similarity threshold
const RAISED_THRESHOLD = 0.68 // Higher threshold for soft-capped topics

export async function addNoteFlow(params: CreateNoteParams, store: StoreState) {
  console.log('addNoteFlow received params:', {
    videoId: params.videoId,
    originalUrl: params.originalUrl,
    videoTitle: params.videoTitle,
    hasTranscript: !!params.transcript
  })
  const { transcript, userPrompt } = params

  // 1) Summarize & get initial canonical suggestion
  const { summary, canonical_name, keywords, subjects } = await summarizeToJSON(
    transcript,
    userPrompt
  )

  // 2) Embed the summary (subject fingerprint)
  const noteEmbedding = await embedText(summary)

  const normName = normalizeTagName(canonical_name)
  const candidateLabelEmbedding = await embedText(labelEmbeddingText(normName))

  // 3) Compare against existing topic centroids with dynamic threshold
  let bestTopicId: string | null = null
  let bestScore = 0

  for (const topic of Object.values(store.topics)) {
    // Determine threshold based on topic size (soft capping)
    const topicSize = topic.summaryIds.length
    const threshold =
      topicSize >= SOFT_CAP_START ? RAISED_THRESHOLD : BASE_THRESHOLD

    const s_note = cosineSimilarity(noteEmbedding, topicPrototype(topic))
    const labelProto =
      topic.labelEmbedding && topic.labelEmbedding.length
        ? topic.labelEmbedding
        : topicPrototype(topic)
    const s_label = cosineSimilarity(candidateLabelEmbedding, labelProto)
    const s_fused = 0.7 * s_note + 0.3 * s_label

    // Only consider this topic if it exceeds the dynamic threshold
    if (s_fused > threshold && s_fused > bestScore) {
      bestScore = s_fused
      bestTopicId = topic.id
    }
  }

  // 4) Create note
  const noteId = uid('note')

  // 5) Decide topic (existing vs new)
  let topicId: string
  let matchedExisting = false

  // A) Name/alias resolution first (handles hyphens, case, order)
  const nameResolvedId = resolveTopicByName(canonical_name, store.topics)
  if (nameResolvedId) {
    topicId = nameResolvedId
    matchedExisting = true
  } else if (bestTopicId && bestScore >= BASE_THRESHOLD) {
    // B) Embedding similarity match (already checked against dynamic threshold)
    topicId = bestTopicId
    matchedExisting = true
  } else {
    // C) New topic with the LLM's suggested canonical name (editable later)
    topicId = uid('topic')
    const normName = normalizeTagName(canonical_name)
    const nameEmb = await embedText(labelEmbeddingText(normName))
    const blended = averageVectors([noteEmbedding, nameEmb])
    const newTopic: Topic = {
      id: topicId,
      name: normName,
      aliases: [],
      embedding: blended, // seed with blend so early matches are stronger
      labelEmbedding: nameEmb, // store label embedding
      summaryIds: [],
      displayTag: ''
    }
    store.setTopics((prev) => ({ ...prev, [topicId]: newTopic }))
  }

  // If we matched an existing topic but the model suggested a different surface name,
  // add that suggestion as an alias to improve future string-level resolution.
  if (matchedExisting) {
    store.setTopics((prev) => {
      const t = { ...prev[topicId] } as Topic
      const cand = canonical_name
      const candNorm = normalizeTagName(cand)
      const nameNorm = normalizeTagName(t.name)
      const hasAlias = (t.aliases || []).some(
        (a) => normalizeTagName(a) === candNorm
      )
      if (candNorm !== nameNorm && !hasAlias) {
        t.aliases = [...(t.aliases || []), cand]
      }
      return { ...prev, [topicId]: t }
    })
  }

  // 6) Persist note
  const newNote: NoteSummary = {
    id: noteId,
    createdAt: Date.now(),
    transcript,
    summary,
    embedding: noteEmbedding,
    topicId,
    canonicalSuggested: canonical_name,
    keywords,
    subjects,
    // Add video metadata
    segments: params.segments,
    videoId: params.videoId,
    originalUrl: params.originalUrl,
    videoTitle: params.videoTitle
  }
  console.log('Created note with video data:', {
    videoId: newNote.videoId,
    originalUrl: newNote.originalUrl
  })
  store.setSummaries((prev) => ({ ...prev, [noteId]: newNote }))

  // 7) Attach note to topic + update centroid (with hard cap eviction)
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    let children = [...(t.summaryIds || []), noteId]

    // Hard cap: If we exceed HARD_CAP, evict the furthest outlier
    if (children.length > HARD_CAP) {
      console.log(
        `Topic ${topicId} exceeds hard cap (${HARD_CAP}), evicting outlier...`
      )

      // Get all summaries for this topic
      const allSummaries = loadSummaries()

      // Calculate distances for all existing notes (excluding the new one)
      const distances = t.summaryIds.map((id) => ({
        id,
        similarity: cosineSimilarity(
          allSummaries[id]?.embedding || [],
          t.embedding
        )
      }))

      // Sort by similarity (ascending) and remove the furthest outlier
      distances.sort((a, b) => a.similarity - b.similarity)
      const outlierId = distances[0].id

      console.log(
        `Evicting note ${outlierId} with similarity ${distances[0].similarity}`
      )
      children = children.filter((id) => id !== outlierId)
    }

    // Update topic with new children list and recompute centroid
    const vecs = children.map((id) =>
      id === noteId ? noteEmbedding : prevSummaryEmbedding(id)
    )
    t.summaryIds = children
    t.embedding = averageVectors(vecs)

    function prevSummaryEmbedding(id: string): number[] {
      const sm = loadSummaries() // read latest from LS (since setState is async)
      return sm[id]?.embedding || []
    }

    return { ...prev, [topicId]: t }
  })

  return { noteId, topicId }
}

// New helper function for manual topic reassignment
export async function reassignNoteToTopic(
  noteId: string,
  newTopicId: string,
  store: StoreState
) {
  const summaries = loadSummaries()
  const note = summaries[noteId]
  if (!note) return

  const oldTopicId = note.topicId

  // Remove from old topic
  store.setTopics((prev) => {
    const updatedTopics = { ...prev }

    // Remove from old topic
    if (oldTopicId && updatedTopics[oldTopicId]) {
      const oldTopic = { ...updatedTopics[oldTopicId] }
      oldTopic.summaryIds = oldTopic.summaryIds.filter((id) => id !== noteId)

      // Recompute old topic centroid
      const oldVecs = oldTopic.summaryIds.map(
        (id) => summaries[id]?.embedding || []
      )
      if (oldVecs.length > 0) {
        oldTopic.embedding = averageVectors(oldVecs)
      }
      updatedTopics[oldTopicId] = oldTopic
    }

    // Add to new topic
    const newTopic = { ...updatedTopics[newTopicId] }
    let newChildren = [...newTopic.summaryIds, noteId]

    // Apply hard cap if needed
    if (newChildren.length > HARD_CAP) {
      console.log(
        `Manual reassignment to topic ${newTopicId} triggers eviction...`
      )

      // Calculate distances for all notes in the new topic
      const distances = newChildren.map((id) => ({
        id,
        similarity: cosineSimilarity(
          summaries[id]?.embedding || [],
          newTopic.embedding
        )
      }))

      // Sort and remove furthest outlier
      distances.sort((a, b) => a.similarity - b.similarity)
      const outlierId = distances[0].id
      console.log(
        `Evicting note ${outlierId} with similarity ${distances[0].similarity}`
      )

      newChildren = newChildren.filter((id) => id !== outlierId)
    }

    // Update new topic
    newTopic.summaryIds = newChildren
    const newVecs = newChildren.map((id) => summaries[id]?.embedding || [])
    newTopic.embedding = averageVectors(newVecs)
    updatedTopics[newTopicId] = newTopic

    return updatedTopics
  })

  // Update the note's topicId
  store.setSummaries((prev) => {
    const updated = { ...prev }
    updated[noteId] = { ...updated[noteId], topicId: newTopicId }
    return updated
  })
}
