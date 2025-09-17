// types.ts - Updated with multi-topic support

export interface Topic {
  id: string
  name: string // Semantic fingerprint (normalized)
  displayTag?: string // Human-readable display name
  aliases: string[]
  embedding: number[]
  labelEmbedding?: number[]
  summaryIds: string[]
  exemplarIds?: string[] // For future: IDs of best examples
}

export interface NoteSummary {
  id: string
  createdAt: number
  transcript: string
  summary: string
  fullSummary?: string // For multi-topic: overall video summary (stored on primary)
  embedding: number[]
  topicId: string
  canonicalSuggested: string
  keywords: string[]
  subjects: string[]
  segments?: any[]
  videoId?: string
  originalUrl?: string
  videoTitle?: string
  prominence?: number // For multi-topic: % of content (0-100)
  videoGroupId?: string // For multi-topic: links notes from same video
  isPrimary?: boolean // For multi-topic: is this the primary topic
}

export interface APIResponse {
  summary: string
  canonical_name: string
  keywords: string[]
}

export interface CreateArgs {
  url: string
  prompt: string
  multiTopic?: boolean
}

export interface CreateNoteParams {
  transcript: string
  userPrompt: string
  segments?: any[]
  videoId?: string
  originalUrl?: string
  videoTitle?: string
  multiTopic?: boolean
}

export interface StoreState {
  topics: Record<string, Topic>
  summaries: Record<string, NoteSummary>
  setTopics: (
    setter: (prev: Record<string, Topic>) => Record<string, Topic>
  ) => void
  setSummaries: (
    setter: (prev: Record<string, NoteSummary>) => Record<string, NoteSummary>
  ) => void
}
