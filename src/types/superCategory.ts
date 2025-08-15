// types/superCategory.ts

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
