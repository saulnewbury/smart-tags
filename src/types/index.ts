// types/index.ts

export type SuperCategory = {
  id: string
  name: string // semantic fingerprint for broad category matching
  displayTag: string // human-readable super category name
  aliases: string[]
  embedding: number[] // embedding of the semantic fingerprint
  labelEmbedding?: number[] // embedding of canonical name
  topicIds: string[] // topics that belong to this super category
  color?: string // optional color for visual organization
}

export type Topic = {
  id: string
  name: string // semantic fingerprint (canonical)
  displayTag: string // human-readable tag for organization
  aliases: string[]
  embedding: number[] // centroid of summaries
  labelEmbedding?: number[] // embedding of canonical name (fingerprint)
  summaryIds: string[]
  superCategoryId?: string // foreign key -> SuperCategory.id
}

export type NoteSummary = {
  id: string
  createdAt: number
  transcript: string
  summary: string
  embedding: number[] // embedding of the summary text
  topicId: string // foreign key -> Topic.id
  canonicalSuggested: string // LLM's first guess (semantic fingerprint)
  keywords: string[]
}

export interface CreateNoteParams {
  transcript: string
  userPrompt: string
}

export interface StoreState {
  topics: Record<string, Topic>
  setTopics: React.Dispatch<React.SetStateAction<Record<string, Topic>>>
  summaries: Record<string, NoteSummary>
  setSummaries: React.Dispatch<
    React.SetStateAction<Record<string, NoteSummary>>
  >
  superCategories: Record<string, SuperCategory>
  setSuperCategories: React.Dispatch<
    React.SetStateAction<Record<string, SuperCategory>>
  >
}

export interface CreateArgs {
  url: string
  prompt: string
}

export interface APIResponse {
  summary: string
  canonical_name: string
  keywords: string[]
}
