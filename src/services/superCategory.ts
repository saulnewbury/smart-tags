// services/superCategory.ts

import type { SuperCategory, Topic } from '../types'
import { embedText } from '../utils/openai'
import { normalizeTagName, labelEmbeddingText } from '../utils/textProcessing'
import { uid } from '../utils/storage'
import { cosineSimilarity } from '../utils/vectorMath' // Fixed import

/**
 * Find the best matching super category for a topic based on semantic similarity
 */
export async function findBestSuperCategory(
  topicName: string,
  topicEmbedding: number[],
  superCategories: Record<string, SuperCategory>,
  threshold: number = 0.7
): Promise<string | null> {
  let bestMatch: string | null = null
  let bestScore = threshold

  for (const superCat of Object.values(superCategories)) {
    if (superCat.embedding.length === 0) continue

    const similarity = cosineSimilarity(topicEmbedding, superCat.embedding)
    if (similarity > bestScore) {
      bestScore = similarity
      bestMatch = superCat.id
    }

    // Also check against aliases
    for (const alias of superCat.aliases) {
      const normalizedTopic = normalizeTagName(topicName)
      const normalizedAlias = normalizeTagName(alias)
      if (
        normalizedTopic.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedTopic)
      ) {
        return superCat.id
      }
    }
  }

  return bestMatch
}

/**
 * Create a new super category
 */
export async function createSuperCategory(
  name: string,
  displayTag: string
): Promise<SuperCategory> {
  const normalizedName = normalizeTagName(name)
  const embedding = await embedText(labelEmbeddingText(normalizedName))

  return {
    id: uid('super'),
    name: normalizedName,
    displayTag: displayTag.trim(),
    aliases: [],
    embedding,
    labelEmbedding: embedding,
    topicIds: [],
    color: generateRandomColor()
  }
}

/**
 * Suggest a super category based on topic content
 */
export function suggestSuperCategory(topicName: string): string {
  const name = topicName.toLowerCase()

  // Common super category mappings
  const suggestions: Record<string, string> = {
    // Politics & Current Events
    politics: 'politics',
    war: 'politics',
    conflict: 'politics',
    election: 'politics',
    government: 'politics',
    policy: 'politics',

    // Technology
    technology: 'technology',
    software: 'technology',
    ai: 'technology',
    programming: 'technology',
    computer: 'technology',
    digital: 'technology',

    // Science
    science: 'science',
    research: 'science',
    study: 'science',
    biology: 'science',
    physics: 'science',
    chemistry: 'science',

    // Business & Finance
    business: 'business',
    finance: 'business',
    economy: 'business',
    market: 'business',
    investment: 'business',
    startup: 'business',

    // Health & Medicine
    health: 'health',
    medicine: 'health',
    medical: 'health',
    fitness: 'health',
    wellness: 'health',

    // Education
    education: 'education',
    learning: 'education',
    teaching: 'education',
    school: 'education',
    university: 'education'
  }

  for (const [keyword, category] of Object.entries(suggestions)) {
    if (name.includes(keyword)) {
      return category
    }
  }

  return 'general'
}

function generateRandomColor(): string {
  const colors = [
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#EC4899',
    '#6366F1',
    '#14B8A6',
    '#EAB308'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
