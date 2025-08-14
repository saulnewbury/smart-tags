// utils/openai.ts

import type { APIResponse } from '../types'

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
const SUMMARIZE_MODEL = 'gpt-4o-mini' // fast & inexpensive for prototyping
const EMBEDDING_MODEL = 'text-embedding-3-small' // great quality/cost

export async function summarizeToJSON(
  transcript: string,
  userPrompt: string
): Promise<APIResponse> {
  const system = `You are a precise note summarizer for a tagging app. 
Return STRICT JSON with keys: summary, canonical_name, keywords (array). 
- summary: 4-6 tight sentences (or 6-10 bullets if source is long).
- canonical_name: the single best subject label for this note (neutral, general), no hashtags.
- keywords: 5-12 short items (entities, noun phrases, actions).`

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
    return parsed
  } catch (e) {
    // Fallback: wrap plain text into JSON-ish object
    return {
      summary: content,
      canonical_name: 'general',
      keywords: []
    }
  }
}

export async function embedText(text: string): Promise<number[]> {
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
    throw new Error(`Embedding API error: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.data?.[0]?.embedding ?? []
}
