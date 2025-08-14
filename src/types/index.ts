// types/index.ts

export type Topic = {
  id: string
  name: string // canonical
  aliases: string[]
  embedding: number[] // centroid of summaries
  labelEmbedding?: number[] // embedding of canonical name
  summaryIds: string[]
}

export type NoteSummary = {
  id: string
  createdAt: number
  transcript: string
  summary: string
  embedding: number[] // embedding of the summary text
  topicId: string // foreign key -> Topic.id
  canonicalSuggested: string // LLM's first guess
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
