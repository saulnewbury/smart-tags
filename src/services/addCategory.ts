// services/addCategory.ts

import type { StoreState, Category, Topic } from '../types'
import { uid } from '../utils/storage'
import {
  normalizeTagName,
  resolveCategoryByName,
  labelEmbeddingText
} from '../utils/textProcessing'
import {
  cosineSimilarity,
  averageVectors,
  topicPrototype,
  categoryPrototype // Add this to vectorMath.ts as previously suggested
} from '../utils/vectorMath'
import { embedText } from '../utils/openai'

const CATEGORY_SIMILARITY_THRESHOLD = 0.74 // Lower for broader grouping; tune

export async function assignCategoryToTopic(
  topicId: string,
  store: StoreState
) {
  const topic = store.topics[topicId]
  if (!topic) return

  // Mirror note embedding: use topic's prototype as "fingerprint"
  const topicProto = topicPrototype(topic)

  // Mirror LLM canonical suggestion: get super-canonical
  const candidateSuperName = await getSuperCanonicalName(topic.name)
  const normSuperName = normalizeTagName(candidateSuperName)
  const candidateLabelEmbedding = await embedText(
    labelEmbeddingText(normSuperName)
  )

  // Mirror topic matching: compare against existing categories
  let bestCategoryId: string | null = null
  let bestScore = 0
  for (const cat of Object.values(store.categories)) {
    const s_topic = cosineSimilarity(topicProto, categoryPrototype(cat))
    const labelProto =
      cat.labelEmbedding && cat.labelEmbedding.length
        ? cat.labelEmbedding
        : categoryPrototype(cat)
    const s_label = cosineSimilarity(candidateLabelEmbedding, labelProto)
    const s_fused = 0.7 * s_topic + 0.3 * s_label

    if (s_fused > bestScore) {
      bestScore = s_fused
      bestCategoryId = cat.id
    }
  }

  // Mirror name resolution
  let categoryId: string
  let matchedExisting = false

  const nameResolvedId = resolveCategoryByName(
    candidateSuperName,
    store.categories
  )
  if (nameResolvedId) {
    categoryId = nameResolvedId
    matchedExisting = true
  } else if (bestCategoryId && bestScore >= CATEGORY_SIMILARITY_THRESHOLD) {
    categoryId = bestCategoryId
    matchedExisting = true
  } else {
    // Mirror new topic creation
    categoryId = uid('category')
    const nameEmb = await embedText(labelEmbeddingText(normSuperName))
    const blended = averageVectors([topicProto, nameEmb])
    const newCategory: Category = {
      id: categoryId,
      name: normSuperName,
      aliases: [],
      embedding: blended,
      labelEmbedding: nameEmb,
      topicIds: [],
      displayTag: ''
    }
    store.setCategories((prev) => ({ ...prev, [categoryId]: newCategory }))
  }

  // Mirror alias addition
  if (matchedExisting) {
    store.setCategories((prev) => {
      const c = { ...prev[categoryId] } as Category
      const candNorm = normalizeTagName(candidateSuperName)
      const nameNorm = normalizeTagName(c.name)
      const hasAlias = c.aliases.some((a) => normalizeTagName(a) === candNorm)
      if (candNorm !== nameNorm && !hasAlias) {
        c.aliases = [...c.aliases, candidateSuperName]
      }
      return { ...prev, [categoryId]: c }
    })
  }

  // Mirror attachment and centroid update
  store.setCategories((prev) => {
    const c = { ...prev[categoryId] } as Category
    if (!c.topicIds.includes(topicId)) {
      const children = [...c.topicIds, topicId]
      const vecs = children.map((id) => topicPrototype(store.topics[id]))
      c.topicIds = children
      c.embedding = averageVectors(vecs)
    }
    return { ...prev, [categoryId]: c }
  })

  // Update topic reference
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    t.categoryId = categoryId
    return { ...prev, [topicId]: t }
  })
}

// LLM helper (mirrors summarizeToJSON but simpler; could move to openai.ts if reused)
async function getSuperCanonicalName(topicName: string): Promise<string> {
  const system =
    'You are a category suggester. Return only the single broader super-category name (neutral, general, no hashtags).'
  const user = `Topic: ${topicName}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    })
  })

  if (!res.ok) throw new Error('Super-canonical API error')
  const data = await res.json()
  return data.choices[0].message.content.trim() || 'general'
}
