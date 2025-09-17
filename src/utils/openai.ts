// utils/openai.ts - Updated with multi-topic support

import type { APIResponse } from '../types'

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
const SUMMARIZE_MODEL = 'gpt-4o-mini'
const EMBEDDING_MODEL = 'text-embedding-3-small'

const USE_LOCAL_EMBEDDINGS =
  process.env.NEXT_PUBLIC_USE_LOCAL_EMBEDDINGS === 'true'

interface TopicAnalysis {
  summary: string
  canonical_name: string
  keywords: string[]
  subjects: string[]
  prominence: number // Percentage of content (0-100)
}

export interface MultiTopicResponse {
  primary_topic: TopicAnalysis
  secondary_topics: TopicAnalysis[]
  full_summary: string // Overall summary of the entire content
}

export async function summarizeToJSON(
  transcript: string,
  userPrompt: string,
  multiTopic: boolean = false
): Promise<APIResponse & { subjects: string[] }> {
  if (!multiTopic) {
    // Original single-topic behavior
    return summarizeToJSONSingle(transcript, userPrompt)
  } else {
    // New multi-topic behavior
    return summarizeToJSONMulti(transcript, userPrompt)
  }
}

// Original single-topic function (unchanged)
async function summarizeToJSONSingle(
  transcript: string,
  userPrompt: string
): Promise<APIResponse & { subjects: string[] }> {
  const system = `You are a precise note summarizer for a tagging app. 
Return STRICT JSON with keys: summary, canonical_name, keywords (array), subjects (array). 
- summary: 4-6 tight sentences (or 6-10 bullets if source is long).
- canonical_name: the single best subject label for this note (neutral, general), no hashtags.
- keywords: 5-12 short items (entities, noun phrases, actions).
- subjects: Select the SINGLE most fitting primary super-category from this predefined list (based on the transcript content and canonical_name), and optionally up to TWO additional secondary categories if they strongly apply (no duplicates). The list is: 
  "World & Politics: Geopolitics, current affairs, government, diplomacy, law, human rights",
  "Society & Culture: Identity, norms, religion, lifestyle, media, social movements",
  "Science & Environment: Natural sciences, sustainability, climate, biology, earth systems",
  "Technology & Innovation: AI, software, hardware, digital systems, design, startups",
  "Economy & Work: Business, finance, markets, labor, economic theory",
  "History & Philosophy: Historical events, timelines, legacy systems, big ideas, ethics",
  "Health & Wellbeing: Physical/mental health, medicine, psychology, fitness",
  "Education & Learning: Schools, pedagogy, study techniques, lifelong learning, research methods".
Output an array of 1-3 strings: the primary category name FIRST (e.g., "World & Politics"), followed by secondaries if any.`

  const user = `TRANSCRIPT:\n${transcript}\n\nEXTRA INSTRUCTIONS FROM USER (optional): ${
    userPrompt || '(none)'
  }`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: SUMMARIZE_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Summarize API error: ${res.status} ${text}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim() ?? '{}'
  try {
    const parsed = JSON.parse(content)
    if (!parsed.summary || !parsed.canonical_name) throw new Error('Bad JSON')
    parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : []
    parsed.subjects = Array.isArray(parsed.subjects) ? parsed.subjects : []
    return parsed
  } catch (e) {
    return {
      summary: content,
      canonical_name: 'general',
      keywords: [],
      subjects: []
    }
  }
}

// New multi-topic function
export async function summarizeToJSONMulti(
  transcript: string,
  userPrompt: string
): Promise<MultiTopicResponse> {
  const system = `You are a precise note summarizer that identifies MULTIPLE distinct topics within content.
Return STRICT JSON with this structure:
{
  "full_summary": "A comprehensive 6-10 sentence summary of the entire content",
  "primary_topic": {
    "canonical_name": "main topic label",
    "summary": "4-6 sentences about this specific topic",
    "keywords": ["5-8 keywords specific to this topic"],
    "subjects": ["1-2 super-categories"],
    "prominence": 60
  },
  "secondary_topics": [
    {
      "canonical_name": "secondary topic label",
      "summary": "3-4 sentences about this specific topic",
      "keywords": ["4-6 keywords specific to this topic"],
      "subjects": ["1-2 super-categories"],
      "prominence": 25
    }
  ]
}

Rules:
- Identify 1-3 DISTINCT topics that are substantively discussed (not just mentioned)
- primary_topic should cover the main theme (usually 40-70% of content)
- secondary_topics array can have 0-2 topics that are substantially discussed (at least 20% each)
- prominence values should sum to approximately 100
- Each topic should be genuinely distinct - don't split closely related concepts
- canonical_names should be specific and meaningful topic labels
- subjects must be from: "World & Politics", "Society & Culture", "Science & Environment", "Technology & Innovation", "Economy & Work", "History & Philosophy", "Health & Wellbeing", "Education & Learning"`

  const user = `TRANSCRIPT:\n${transcript}\n\nEXTRA INSTRUCTIONS FROM USER (optional): ${
    userPrompt || '(none)'
  }\n\nIdentify distinct topics discussed in this content. Only include secondary topics if they are substantially discussed, not just mentioned in passing.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: SUMMARIZE_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Summarize API error: ${res.status} ${text}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim() ?? '{}'

  try {
    const parsed = JSON.parse(content)

    // Validate and clean the response
    if (!parsed.primary_topic) {
      throw new Error('Missing primary_topic')
    }

    // Ensure secondary_topics is an array
    parsed.secondary_topics = Array.isArray(parsed.secondary_topics)
      ? parsed.secondary_topics
      : []

    // Validate each topic has required fields
    const validateTopic = (topic: any) => {
      topic.keywords = Array.isArray(topic.keywords) ? topic.keywords : []
      topic.subjects = Array.isArray(topic.subjects) ? topic.subjects : []
      topic.prominence = topic.prominence || 50
      return topic
    }

    parsed.primary_topic = validateTopic(parsed.primary_topic)
    parsed.secondary_topics = parsed.secondary_topics.map(validateTopic)

    return parsed
  } catch (e) {
    console.error('Failed to parse multi-topic response:', e)
    // Fallback to single topic structure
    return {
      full_summary: transcript.substring(0, 500) + '...',
      primary_topic: {
        summary: transcript.substring(0, 500) + '...',
        canonical_name: 'general',
        keywords: [],
        subjects: [],
        prominence: 100
      },
      secondary_topics: []
    }
  }
}

// Local embedding function (unchanged)
async function embedTextLocal(text: string): Promise<number[]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Local embedding error: ${res.status} ${error}`)
  }

  const data = await res.json()
  return data.embedding
}

// OpenAI embedding function (unchanged)
async function embedTextOpenAI(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI Embedding API error: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.data?.[0]?.embedding ?? []
}

// Main embedding function (unchanged)
export async function embedText(text: string): Promise<number[]> {
  if (USE_LOCAL_EMBEDDINGS) {
    console.log('[embedText] Using local embeddings')
    return embedTextLocal(text)
  } else {
    console.log('[embedText] Using OpenAI embeddings')
    return embedTextOpenAI(text)
  }
}

// Batch embedding function (unchanged)
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (USE_LOCAL_EMBEDDINGS) {
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ texts })
    })

    if (!res.ok) {
      throw new Error(`Local batch embedding error: ${res.status}`)
    }

    const data = await res.json()
    return data.embeddings
  } else {
    return Promise.all(texts.map((text) => embedTextOpenAI(text)))
  }
}
