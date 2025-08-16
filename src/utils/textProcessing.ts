// utils/textProcessing.ts

import type { Topic, Category } from '../types'

export function normalizeTagName(s: string): string {
  // lowercase first so replacements are simple
  let t = s.toLowerCase()

  // unify separators
  t = t
    .replaceAll('–', ' ')
    .replaceAll('—', ' ')
    .replaceAll('−', ' ')
    .replaceAll('-', ' ')
    .replaceAll('/', ' ')
    .replaceAll('_', ' ')

  // common symbol words
  t = t.replaceAll('&', ' and ')

  // strip non alphanum/space
  t = t.replace(/[^a-z0-9 ]/g, ' ')

  // collapse spaces
  return t.replace(/\s+/g, ' ').trim()
}

export function stemWord(word: string): string {
  // Basic English stemmer (Porter-inspired, simplified for prototype)
  if (word.length < 3) return word
  word = word.toLowerCase()

  // Remove common suffixes
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('es') || word.endsWith('ed') || word.endsWith('ing'))
    return word.slice(0, -2)
  if (
    word.endsWith('s') ||
    word.endsWith('ly') ||
    word.endsWith('ment') ||
    word.endsWith('ness')
  )
    return word.slice(0, -1)

  // Handle doubles (e.g., stopping → stop)
  if (
    /[bcdfghjklmnpqrstvwxyz]/.test(word.slice(-1)) &&
    word.slice(-2, -1) === word.slice(-1)
  ) {
    word = word.slice(0, -1)
  }

  return word
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'and',
  'to',
  'for',
  'with',
  'at',
  'by',
  'into',
  'from',
  'as'
])

export function tokenizeCore(s: string): string[] {
  return normalizeTagName(s)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stemWord)
}

export function sameTokenSet(a: string, b: string): boolean {
  const A = new Set(tokenizeCore(a))
  const B = new Set(tokenizeCore(b))
  if (A.size !== B.size) return false
  for (const x of A) if (!B.has(x)) return false
  return true
}

export function jaccardTokenSim(a: string, b: string): number {
  const A = new Set(tokenizeCore(a))
  const B = new Set(tokenizeCore(b))
  if (!A.size && !B.size) return 1
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const uni = new Set([...A, ...B]).size
  return uni ? inter / uni : 0
}

export function resolveTopicByName(
  candidate: string,
  topics: Record<string, Topic>
): string | null {
  const norm = normalizeTagName(candidate)

  // 1) exact normalized name or alias
  for (const t of Object.values(topics)) {
    if (normalizeTagName(t.name) === norm) return t.id
    if ((t.aliases || []).some((a) => normalizeTagName(a) === norm)) return t.id
  }

  // 2) exact token set (order-insensitive)
  for (const t of Object.values(topics)) {
    if (sameTokenSet(t.name, candidate)) return t.id
  }

  // 3) high token overlap for tiny wording diffs
  let bestId: string | null = null,
    best = 0
  for (const t of Object.values(topics)) {
    const s = jaccardTokenSim(t.name, candidate)
    if (s > best) {
      best = s
      bestId = t.id
    }
  }
  return best >= 0.6 ? bestId : null
}

// Add to textProcessing.ts

export function resolveCategoryByName(
  candidate: string,
  categories: Record<string, Category>
): string | null {
  const norm = normalizeTagName(candidate)

  // 1) exact normalized name or alias
  for (const c of Object.values(categories)) {
    if (normalizeTagName(c.name) === norm) return c.id
    if ((c.aliases || []).some((a) => normalizeTagName(a) === norm)) return c.id
  }

  // 2) exact token set (order-insensitive)
  for (const c of Object.values(categories)) {
    if (sameTokenSet(c.name, candidate)) return c.id
  }

  // 3) high token overlap for tiny wording diffs
  let bestId: string | null = null,
    best = 0
  for (const c of Object.values(categories)) {
    const s = jaccardTokenSim(c.name, candidate)
    if (s > best) {
      best = s
      bestId = c.id
    }
  }
  return best >= 0.6 ? bestId : null
}

export function labelEmbeddingText(name: string): string {
  // tiny definition string makes short labels embed more stably
  return `topic name: ${name}\nmeaning: a subject category used to group notes about ${name}`
}

export function trimTitle(text: string, n = 80) {
  const t = text.replace(/\n/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
