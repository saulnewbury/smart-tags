'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Tag, RefreshCw } from 'lucide-react'

// -----------------------------
// Types
// -----------------------------

type Topic = {
  id: string
  name: string // canonical
  aliases: string[]
  embedding: number[] // centroid of summaries
  labelEmbedding?: number[] // ⟵ NEW: embedding of canonical name
  summaryIds: string[]
}

type NoteSummary = {
  id: string
  createdAt: number
  transcript: string
  summary: string
  embedding: number[] // embedding of the summary text
  topicId: string // foreign key -> Topic.id
  canonicalSuggested: string // LLM's first guess
  keywords: string[]
}

// -----------------------------
// Local storage helpers (very simple proto-store)
// -----------------------------

const LS_KEYS = {
  topics: 'gist-topics',
  summaries: 'gist-summaries',
  apiKey: 'gist-openai-key'
}

function loadTopics(): Record<string, Topic> {
  try {
    const json = localStorage.getItem(LS_KEYS.topics)
    return json ? (JSON.parse(json) as Record<string, Topic>) : {}
  } catch {
    return {}
  }
}

function saveTopics(map: Record<string, Topic>) {
  localStorage.setItem(LS_KEYS.topics, JSON.stringify(map))
}

function loadSummaries(): Record<string, NoteSummary> {
  try {
    const json = localStorage.getItem(LS_KEYS.summaries)
    return json ? (JSON.parse(json) as Record<string, NoteSummary>) : {}
  } catch {
    return {}
  }
}

function saveSummaries(map: Record<string, NoteSummary>) {
  localStorage.setItem(LS_KEYS.summaries, JSON.stringify(map))
}

function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`
}

// -----------------------------
// Vector math (cosine similarity + incremental centroid)
// -----------------------------

function cosineSimilarity(a: number[], b: number[]): number {
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

function averageVectors(vectors: number[][]): number[] {
  if (!vectors.length) return []
  const len = vectors[0].length
  const acc = new Array(len).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < len; i++) acc[i] += v[i]
  }
  return acc.map((x) => x / vectors.length)
}

function topicPrototype(t: Topic): number[] {
  return t.labelEmbedding && t.labelEmbedding.length
    ? averageVectors([t.embedding, t.labelEmbedding])
    : t.embedding
}

// -----------------------------
// Tag Name Normalization & Alias Resolution
// -----------------------------

function normalizeTagName(s: string): string {
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

  // demonyms → base nouns
  // t = t.replaceAll('israeli', 'israel').replaceAll('palestinian', 'palestine')

  // strip non alphanum/space
  t = t.replace(/[^a-z0-9 ]/g, ' ')

  // collapse spaces
  return t.replace(/\s+/g, ' ').trim()
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

function tokenizeCore(s: string): string[] {
  return normalizeTagName(s)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
}

function sameTokenSet(a: string, b: string): boolean {
  const A = new Set(tokenizeCore(a))
  const B = new Set(tokenizeCore(b))
  if (A.size !== B.size) return false
  for (const x of A) if (!B.has(x)) return false
  return true
}

function jaccardTokenSim(a: string, b: string): number {
  const A = new Set(tokenizeCore(a))
  const B = new Set(tokenizeCore(b))
  if (!A.size && !B.size) return 1
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const uni = new Set([...A, ...B]).size
  return uni ? inter / uni : 0
}

function resolveTopicByName(
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
  return best >= 0.8 ? bestId : null
}

function labelEmbeddingText(name: string): string {
  // tiny definition string makes short labels embed more stably
  return `topic name: ${name}\nmeaning: a subject category used to group notes about ${name}`
}

// -----------------------------
// OpenAI helpers (client-side, for prototyping only)
// -----------------------------

const SUMMARIZE_MODEL = 'gpt-4o-mini' // fast & inexpensive for prototyping
const EMBEDDING_MODEL = 'text-embedding-3-small' // great quality/cost

async function summarizeToJSON(
  apiKey: string,
  transcript: string,
  userPrompt: string
): Promise<{ summary: string; canonical_name: string; keywords: string[] }> {
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
      Authorization: `Bearer ${apiKey}`
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

async function embedText(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
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

// -----------------------------
// App State Hook
// -----------------------------

function useStore() {
  const [topics, setTopics] = useState<Record<string, Topic>>({})
  const [summaries, setSummaries] = useState<Record<string, NoteSummary>>({})
  const [apiKey, setApiKey] = useState<string>('')

  useEffect(() => {
    setTopics(loadTopics())
    setSummaries(loadSummaries())
    setApiKey(localStorage.getItem(LS_KEYS.apiKey) || '')
  }, [])

  useEffect(() => saveTopics(topics), [topics])
  useEffect(() => saveSummaries(summaries), [summaries])

  function persistApiKey(key: string) {
    setApiKey(key)
    localStorage.setItem(LS_KEYS.apiKey, key)
  }

  return {
    topics,
    setTopics,
    summaries,
    setSummaries,
    apiKey,
    persistApiKey
  }
}

function findTopicIdByCanonicalName(
  name: string,
  topics: Record<string, Topic>
): string | null {
  const norm = normalizeTagName(name)
  for (const t of Object.values(topics))
    if (normalizeTagName(t.name) === norm) return t.id
  return null
}

// -----------------------------
// Core: add note (summarize → embed → match topic → save)
// -----------------------------

// const SIMILARITY_THRESHOLD = 0.74 // tune for your content
const SIMILARITY_THRESHOLD = 0.6 // tune for your content

async function addNoteFlow(
  params: {
    apiKey: string
    transcript: string
    userPrompt: string
  },
  store: {
    topics: Record<string, Topic>
    setTopics: React.Dispatch<React.SetStateAction<Record<string, Topic>>>
    summaries: Record<string, NoteSummary>
    setSummaries: React.Dispatch<
      React.SetStateAction<Record<string, NoteSummary>>
    >
  }
) {
  const { apiKey, transcript, userPrompt } = params

  // 1) Summarize & get initial canonical suggestion
  const { summary, canonical_name, keywords } = await summarizeToJSON(
    apiKey,
    transcript,
    userPrompt
  )

  // 2) Embed the summary (subject fingerprint)
  const noteEmbedding = await embedText(apiKey, summary)

  const normName = normalizeTagName(canonical_name)
  const candidateLabelEmbedding = await embedText(
    apiKey,
    labelEmbeddingText(normName)
  )

  // 3) Compare against existing topic centroids
  let bestTopicId: string | null = null
  let bestScore = 0
  for (const topic of Object.values(store.topics)) {
    const s_note = cosineSimilarity(noteEmbedding, topicPrototype(topic))
    const labelProto =
      topic.labelEmbedding && topic.labelEmbedding.length
        ? topic.labelEmbedding
        : topicPrototype(topic)
    const s_label = cosineSimilarity(candidateLabelEmbedding, labelProto)
    const s_fused = 0.5 * s_note + 0.5 * s_label

    if (s_fused > bestScore) {
      bestScore = s_fused
      bestTopicId = topic.id
    }
  }

  // 4) Create note
  const noteId = uid('note')

  // 5) Decide topic (existing vs new)
  let topicId: string
  let matchedExisting = false

  // A) Name/alias resolution first (handles hyphens, case, order)
  const nameResolvedId = resolveTopicByName(canonical_name, store.topics)
  if (nameResolvedId) {
    topicId = nameResolvedId
    matchedExisting = true
  } else if (bestTopicId && bestScore >= SIMILARITY_THRESHOLD) {
    // B) Embedding similarity match
    topicId = bestTopicId
    matchedExisting = true
  } else {
    // C) New topic with the LLM's suggested canonical name (editable later)
    topicId = uid('topic')
    const normName = normalizeTagName(canonical_name)
    const nameEmb = await embedText(apiKey, labelEmbeddingText(normName))
    const blended = averageVectors([noteEmbedding, nameEmb])
    const newTopic: Topic = {
      id: topicId,
      name: normName,
      aliases: [],
      embedding: blended, // seed with blend so early matches are stronger
      labelEmbedding: nameEmb, // store label embedding
      summaryIds: []
    }
    store.setTopics((prev) => ({ ...prev, [topicId]: newTopic }))
  }

  // If we matched an existing topic but the model suggested a different surface name,
  // add that suggestion as an alias to improve future string-level resolution.
  if (matchedExisting) {
    store.setTopics((prev) => {
      const t = { ...prev[topicId] } as Topic
      const cand = canonical_name
      const candNorm = normalizeTagName(cand)
      const nameNorm = normalizeTagName(t.name)
      const hasAlias = (t.aliases || []).some(
        (a) => normalizeTagName(a) === candNorm
      )
      if (candNorm !== nameNorm && !hasAlias) {
        t.aliases = [...(t.aliases || []), cand]
      }
      return { ...prev, [topicId]: t }
    })
  }

  // 6) Persist note
  const newNote: NoteSummary = {
    id: noteId,
    createdAt: Date.now(),
    transcript,
    summary,
    embedding: noteEmbedding,
    topicId,
    canonicalSuggested: canonical_name,
    keywords
  }
  store.setSummaries((prev) => ({ ...prev, [noteId]: newNote }))

  // 7) Attach note to topic + update centroid
  store.setTopics((prev) => {
    const t = { ...prev[topicId] } as Topic
    const children = [...(t.summaryIds || []), noteId]
    const vecs = children.map((id) =>
      id === noteId ? noteEmbedding : prevSummaryEmbedding(id)
    )
    t.summaryIds = children
    t.embedding = averageVectors(vecs)

    function prevSummaryEmbedding(id: string): number[] {
      const sm = loadSummaries() // read latest from LS (since setState is async)
      return sm[id]?.embedding || []
    }

    return { ...prev, [topicId]: t }
  })

  return { noteId, topicId }
}

// -----------------------------
// UI Components
// -----------------------------

function Sidebar(props: {
  topics: Record<string, Topic>
  summaries: Record<string, NoteSummary>
  onSelectNote: (id: string) => void
  onCreateNew: () => void
  selectedNoteId?: string | null
}) {
  const groups = useMemo(() => {
    const out: { topic: Topic; notes: NoteSummary[] }[] = []
    const map = props.topics
    const sums = props.summaries
    const byTopic: Record<string, NoteSummary[]> = {}
    for (const s of Object.values(sums)) {
      ;(byTopic[s.topicId] ||= []).push(s)
    }
    for (const t of Object.values(map)) {
      const notes = (byTopic[t.id] || []).sort(
        (a, b) => b.createdAt - a.createdAt
      )
      out.push({ topic: t, notes })
    }
    // sort topics by name
    out.sort((a, b) => a.topic.name.localeCompare(b.topic.name))
    return out
  }, [props.topics, props.summaries])

  return (
    <div className='w-80 shrink-0 border-r h-screen flex flex-col'>
      <div className='p-3 border-b flex items-center justify-between'>
        <div className='font-semibold'>Summaries</div>
        <button
          onClick={props.onCreateNew}
          className='inline-flex items-center gap-2 rounded-xl border px-2 py-1 hover:bg-gray-50'
        >
          <Plus className='h-4 w-4' /> New
        </button>
      </div>
      <div className='overflow-y-auto'>
        {groups.map(({ topic, notes }) => (
          <div key={topic.id} className='border-b'>
            <div className='px-3 py-2 text-sm font-medium bg-gray-50 flex items-center gap-2'>
              <Tag className='h-4 w-4' /> {topic.name}
              <span className='ml-auto text-xs text-gray-500'>
                {notes.length}
              </span>
            </div>
            <ul>
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => props.onSelectNote(n.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      props.selectedNoteId === n.id ? 'bg-gray-100' : ''
                    }`}
                  >
                    {trimTitle(n.summary)}
                    <div className='text-xs text-gray-500'>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function trimTitle(text: string, n = 80) {
  const t = text.replace(/\n/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function DetailView(props: {
  note: NoteSummary | null
  topic: Topic | null
  onRenameTopic: (newName: string) => void
  onResummarize?: () => void
}) {
  if (!props.note || !props.topic) {
    return (
      <div className='flex-1 h-screen flex items-center justify-center text-gray-500'>
        Select a summary from the left, or create a new one.
      </div>
    )
  }

  const [name, setName] = useState(props.topic.name)
  useEffect(() => setName(props.topic!.name), [props.topic])

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b flex items-center gap-2'>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='flex-1 border rounded-lg px-3 py-2'
        />
        <button
          onClick={() => props.onRenameTopic(name)}
          className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50'
        >
          <Save className='h-4 w-4' /> Save Tag Name
        </button>
        {props.onResummarize && (
          <button
            onClick={props.onResummarize}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50'
          >
            <RefreshCw className='h-4 w-4' /> Re-summarize
          </button>
        )}
      </div>

      <div className='p-6 space-y-6'>
        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Canonical Tag
          </div>
          <div className='text-lg font-semibold'>{props.topic.name}</div>
          {props.topic.aliases.length > 0 && (
            <div className='text-xs text-gray-500 mt-1'>
              Aliases: {props.topic.aliases.join(', ')}
            </div>
          )}
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>Summary</div>
          <pre className='whitespace-pre-wrap text-sm leading-6 bg-gray-50 p-3 rounded-lg border'>
            {props.note.summary}
          </pre>
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>Keywords</div>
          <div className='flex flex-wrap gap-2'>
            {props.note.keywords.map((k, i) => (
              <span
                key={i}
                className='text-xs border rounded-full px-2 py-1 bg-white'
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NewSummarizer(props: {
  apiKey: string
  onSetApiKey: (k: string) => void
  onCreate: (args: { transcript: string; prompt: string }) => Promise<void>
  busy: boolean
  error: string | null
}) {
  const [transcript, setTranscript] = useState('')
  const [prompt, setPrompt] = useState('')
  const [showKey, setShowKey] = useState(false)

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b flex items-center gap-2'>
        <div className='font-semibold'>New Transcript</div>
        <div className='ml-auto flex items-center gap-2'>
          <input
            type={showKey ? 'text' : 'password'}
            placeholder='OpenAI API Key'
            value={props.apiKey}
            onChange={(e) => props.onSetApiKey(e.target.value)}
            className='border rounded-lg px-3 py-2 w-80'
          />
          <button
            onClick={() => setShowKey((s) => !s)}
            className='text-xs underline'
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className='p-6 space-y-6'>
        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Optional prompt
          </div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g., Focus on actors and outcomes; 5 bullets'
            className='w-full border rounded-lg px-3 py-2'
          />
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>Transcript</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder='Paste a transcript or long text…'
            className='w-full h-[50vh] border rounded-lg p-3 font-mono text-sm'
          />
        </div>

        {props.error && (
          <div className='text-sm text-red-600'>{props.error}</div>
        )}

        <div className='flex gap-3'>
          <button
            disabled={props.busy || !props.apiKey || !transcript.trim()}
            onClick={() => props.onCreate({ transcript, prompt })}
            className='inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50'
          >
            <Plus className='h-4 w-4' /> Summarize & Tag
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------
// Root Page
// -----------------------------

export default function Page() {
  const store = useStore()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(true) // start on creator view
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedNote: NoteSummary | null = selectedNoteId
    ? store.summaries[selectedNoteId] || null
    : null
  const selectedTopic: Topic | null = selectedNote
    ? store.topics[selectedNote.topicId] || null
    : null

  async function handleCreate(args: { transcript: string; prompt: string }) {
    setBusy(true)
    setError(null)
    try {
      if (!store.apiKey)
        throw new Error('Please enter your OpenAI API key (top right).')
      const { noteId } = await addNoteFlow(
        {
          apiKey: store.apiKey,
          transcript: args.transcript,
          userPrompt: args.prompt
        },
        store
      )
      setCreating(false)
      setSelectedNoteId(noteId)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function handleRenameTopic(newName: string) {
    if (!selectedTopic) return
    const sourceId = selectedTopic.id
    const targetName = normalizeTagName(newName)

    ;(async () => {
      let nameEmb: number[] = []
      try {
        if (store.apiKey)
          nameEmb = await embedText(
            store.apiKey,
            labelEmbeddingText(targetName)
          )
      } catch {}

      store.setTopics((prev) => {
        const t = { ...prev[sourceId] } as Topic
        if (t.name !== targetName) {
          if (!t.aliases.includes(t.name)) t.aliases = [...t.aliases, t.name]
          t.name = targetName
        }
        if (nameEmb.length) t.labelEmbedding = nameEmb
        return { ...prev, [sourceId]: t }
      })
    })()
  }

  return (
    <div className='flex'>
      <Sidebar
        topics={store.topics}
        summaries={store.summaries}
        selectedNoteId={selectedNoteId}
        onSelectNote={(id) => {
          setSelectedNoteId(id)
          setCreating(false)
        }}
        onCreateNew={() => {
          setCreating(true)
          setSelectedNoteId(null)
        }}
      />

      {creating ? (
        <NewSummarizer
          apiKey={store.apiKey}
          onSetApiKey={store.persistApiKey}
          onCreate={handleCreate}
          busy={busy}
          error={error}
        />
      ) : (
        <DetailView
          note={selectedNote}
          topic={selectedTopic}
          onRenameTopic={handleRenameTopic}
        />
      )}
    </div>
  )
}

// -----------------------------
// Notes
// -----------------------------
// • This is a single-file, client-side prototype designed for the Next.js App Router
//   as /app/page.tsx. It calls the OpenAI API from the browser using a user-supplied
//   API key (saved to localStorage). For production, move API calls server-side.
// • The topic centroid embedding is the running average of all summary embeddings
//   attached to that topic. Future notes are matched by cosine similarity to this centroid.
// • Renaming a topic adds the old name to the Aliases list implicitly (string-level fallback).
// • Threshold (SIMILARITY_THRESHOLD) can be tuned per your corpus.
// • Styling uses Tailwind utility classes; swap to your own CSS if not using Tailwind.
