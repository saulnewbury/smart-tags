// utils/vectorMath.ts

import type { Topic, Category } from '../types'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0,
    ma = 0,
    mb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    ma += a[i] * a[i]
    mb += b[i] * b[i]
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb)
  return denom ? dot / denom : 0
}

export function averageVectors(vectors: number[][]): number[] {
  if (!vectors.length) return []
  const len = vectors[0].length
  const acc = new Array(len).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < len; i++) acc[i] += v[i]
  }
  return acc.map((x) => x / vectors.length)
}

export function topicPrototype(t: Topic): number[] {
  return t.labelEmbedding && t.labelEmbedding.length
    ? averageVectors([t.embedding, t.labelEmbedding])
    : t.embedding
}

export function categoryPrototype(c: Category): number[] {
  return c.labelEmbedding && c.labelEmbedding.length
    ? averageVectors([c.embedding, c.labelEmbedding])
    : c.embedding
}
