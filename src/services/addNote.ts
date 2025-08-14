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

const SIMILARITY_THRESHOLD = 0.56 // tune for your content

export async function addNoteFlow(params: CreateNoteParams, store: StoreState) {
  const { transcript, userPrompt } = params

  // 1) Summarize & get initial canonical suggestion
  const { summary, canonical_name, keywords } = await summarizeToJSON(
    transcript,
    userPrompt
  )

  // 2) Embed the summary (subject fingerprint)
  const noteEmbedding = await embedText(summary)

  const normName = normalizeTagName(canonical_name)
  const candidateLabelEmbedding = await embedText(labelEmbeddingText(normName))

  // 3) Compare against existing topic centroids
  let bestTopicId: string | null = null
  let bestScore = 0
  for (const topic of Object.values(store.topics)) {
    const s_note = cosineSimilarity(noteEmbedding, topicPrototype(topic))
    const labelProto =
      topic.labelEmbedding && topic.labelEmbedding.length
        ? topic.labelEmbedding
        : topicPrototype(topic)
    const s_label = cosineSimilarity(candidateLabelEmbedding, labelProto)
    const s_fused = 0.7 * s_note + 0.3 * s_label

    if (s_fused > bestScore) {
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
  } else if (bestTopicId && bestScore >= SIMILARITY_THRESHOLD) {
    // B) Embedding similarity match
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
      summaryIds: []
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
    keywords
  }
  store.setSummaries((prev) => ({ ...prev, [noteId]: newNote }))

  // 7) Attach note to topic + update centroid
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    const children = [...(t.summaryIds || []), noteId]
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
