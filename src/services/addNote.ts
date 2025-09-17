// services/addNote.ts - Updated with multi-topic support

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
import {
  summarizeToJSON,
  summarizeToJSONMulti,
  embedText
} from '../utils/openai'

export interface CreateNoteParams {
  transcript: string
  userPrompt: string
  segments?: any[]
  videoId?: string
  originalUrl?: string
  videoTitle?: string
  multiTopic?: boolean
}

const SIMILARITY_THRESHOLD = 0.56

// Original single-topic flow
async function addSingleNoteFlow(params: CreateNoteParams, store: StoreState) {
  const { transcript, userPrompt } = params

  // 1) Summarize & get initial canonical suggestion
  const { summary, canonical_name, keywords, subjects } = await summarizeToJSON(
    transcript,
    userPrompt,
    false // single topic mode
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

  // A) Name/alias resolution first
  const nameResolvedId = resolveTopicByName(canonical_name, store.topics)
  if (nameResolvedId) {
    topicId = nameResolvedId
    matchedExisting = true
  } else if (bestTopicId && bestScore >= SIMILARITY_THRESHOLD) {
    // B) Embedding similarity match
    topicId = bestTopicId
    matchedExisting = true
  } else {
    // C) New topic
    topicId = uid('topic')
    const normName = normalizeTagName(canonical_name)
    const nameEmb = await embedText(labelEmbeddingText(normName))
    const blended = averageVectors([noteEmbedding, nameEmb])
    const newTopic: Topic = {
      id: topicId,
      name: normName,
      aliases: [],
      embedding: blended,
      labelEmbedding: nameEmb,
      summaryIds: []
    }
    store.setTopics((prev) => ({ ...prev, [topicId]: newTopic }))
  }

  // Add alias if matched existing with different name
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
    segments: params.segments,
    videoId: params.videoId,
    originalUrl: params.originalUrl,
    videoTitle: params.videoTitle
  }

  store.setSummaries((prev) => ({ ...prev, [noteId]: newNote }))

  // 7) Update topic with note
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    const children = [...(t.summaryIds || []), noteId]
    const vecs = children.map((id) =>
      id === noteId ? noteEmbedding : prevSummaryEmbedding(id)
    )
    t.summaryIds = children
    t.embedding = averageVectors(vecs)

    function prevSummaryEmbedding(id: string): number[] {
      const sm = loadSummaries()
      return sm[id]?.embedding || []
    }

    return { ...prev, [topicId]: t }
  })

  return { noteIds: [noteId], topicIds: [topicId] }
}

// New multi-topic flow
async function addMultiNoteFlow(params: CreateNoteParams, store: StoreState) {
  const { transcript, userPrompt } = params

  console.log('Starting multi-topic analysis...')

  // 1) Get multi-topic analysis
  const multiResponse = await summarizeToJSONMulti(transcript, userPrompt)

  const noteIds: string[] = []
  const topicIds: string[] = []
  const videoGroupId = uid('videogroup') // Link notes from same video

  // Process primary topic
  const primaryResult = await processSingleTopic(
    {
      summary: multiResponse.primary_topic.summary,
      canonical_name: multiResponse.primary_topic.canonical_name,
      keywords: multiResponse.primary_topic.keywords,
      subjects: multiResponse.primary_topic.subjects,
      prominence: multiResponse.primary_topic.prominence,
      fullSummary: multiResponse.full_summary,
      isPrimary: true,
      videoGroupId
    },
    params,
    store
  )

  noteIds.push(primaryResult.noteId)
  topicIds.push(primaryResult.topicId)

  // Process secondary topics
  for (const secondaryTopic of multiResponse.secondary_topics) {
    const secondaryResult = await processSingleTopic(
      {
        summary: secondaryTopic.summary,
        canonical_name: secondaryTopic.canonical_name,
        keywords: secondaryTopic.keywords,
        subjects: secondaryTopic.subjects,
        prominence: secondaryTopic.prominence,
        fullSummary: multiResponse.full_summary,
        isPrimary: false,
        videoGroupId
      },
      params,
      store
    )

    noteIds.push(secondaryResult.noteId)
    topicIds.push(secondaryResult.topicId)
  }

  console.log(
    `Created ${noteIds.length} notes across ${new Set(topicIds).size} topics`
  )

  return { noteIds, topicIds }
}

// Helper function to process a single topic within multi-topic flow
async function processSingleTopic(
  topicData: {
    summary: string
    canonical_name: string
    keywords: string[]
    subjects: string[]
    prominence: number
    fullSummary: string
    isPrimary: boolean
    videoGroupId: string
  },
  params: CreateNoteParams,
  store: StoreState
) {
  const {
    summary,
    canonical_name,
    keywords,
    subjects,
    prominence,
    fullSummary,
    isPrimary,
    videoGroupId
  } = topicData

  // Embed the topic-specific summary
  const noteEmbedding = await embedText(summary)
  const normName = normalizeTagName(canonical_name)
  const candidateLabelEmbedding = await embedText(labelEmbeddingText(normName))

  // Find best matching existing topic
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

  // Create note ID
  const noteId = uid('note')

  // Determine topic (existing vs new)
  let topicId: string
  let matchedExisting = false

  const nameResolvedId = resolveTopicByName(canonical_name, store.topics)
  if (nameResolvedId) {
    topicId = nameResolvedId
    matchedExisting = true
  } else if (bestTopicId && bestScore >= SIMILARITY_THRESHOLD) {
    topicId = bestTopicId
    matchedExisting = true
  } else {
    // Create new topic
    topicId = uid('topic')
    const nameEmb = await embedText(labelEmbeddingText(normName))
    const blended = averageVectors([noteEmbedding, nameEmb])
    const newTopic: Topic = {
      id: topicId,
      name: normName,
      aliases: [],
      embedding: blended,
      labelEmbedding: nameEmb,
      summaryIds: []
    }
    store.setTopics((prev) => ({ ...prev, [topicId]: newTopic }))
  }

  // Add alias if needed
  if (matchedExisting) {
    store.setTopics((prev) => {
      const t = { ...prev[topicId] } as Topic
      const candNorm = normalizeTagName(canonical_name)
      const nameNorm = normalizeTagName(t.name)
      const hasAlias = (t.aliases || []).some(
        (a) => normalizeTagName(a) === candNorm
      )
      if (candNorm !== nameNorm && !hasAlias) {
        t.aliases = [...(t.aliases || []), canonical_name]
      }
      return { ...prev, [topicId]: t }
    })
  }

  // Create and persist note
  const newNote: NoteSummary = {
    id: noteId,
    createdAt: Date.now(),
    transcript: params.transcript, // Full transcript
    summary: summary, // Topic-specific summary
    fullSummary: isPrimary ? fullSummary : undefined, // Store full summary only on primary
    embedding: noteEmbedding,
    topicId,
    canonicalSuggested: canonical_name,
    keywords,
    subjects,
    segments: params.segments,
    videoId: params.videoId,
    originalUrl: params.originalUrl,
    videoTitle: params.videoTitle,
    prominence: prominence,
    videoGroupId: videoGroupId,
    isPrimary: isPrimary
  }

  store.setSummaries((prev) => ({ ...prev, [noteId]: newNote }))

  // Update topic centroid
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    const children = [...(t.summaryIds || []), noteId]
    const vecs = children.map((id) => {
      if (id === noteId) return noteEmbedding
      const sm = loadSummaries()
      return sm[id]?.embedding || []
    })
    t.summaryIds = children
    t.embedding = averageVectors(vecs)
    return { ...prev, [topicId]: t }
  })

  return { noteId, topicId }
}

// Main export function that routes to single or multi
export async function addNoteFlow(params: CreateNoteParams, store: StoreState) {
  if (params.multiTopic) {
    return addMultiNoteFlow(params, store)
  } else {
    return addSingleNoteFlow(params, store)
  }
}
