// app/page.tsx

'use client'

import React, { useState } from 'react'
import type { Topic, NoteSummary, CreateArgs, Category } from '../types' // Add Category import
import { useStore } from '@/hooks/useStore'
import { addNoteFlow } from '@/services/addNote'
import { fetchTranscript } from '@/services/transcript'
import { clearAllData } from '@/utils/storage'
import { normalizeTagName, labelEmbeddingText } from '@/utils/textProcessing'
import { embedText } from '@/utils/openai'
import { Sidebar } from '@/components/Sidebar'
import { DetailView } from '@/components/DetailView'
import { NewSummarizer } from '@/components/NewSummarizer'
import { assignCategoryToTopic } from '@/services/addCategory' // Import if renaming might trigger reassignment
import { topicPrototype, averageVectors } from '@/utils/vectorMath'

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
  const selectedCategory: Category | null = selectedTopic
    ? store.categories[selectedTopic.categoryId] || null
    : null

  async function handleCreate(args: CreateArgs) {
    setBusy(true)
    setError(null)
    try {
      // First, fetch the transcript from the API route
      const transcript = await fetchTranscript(args.url)

      // Now proceed with summarization using the fetched transcript
      const { noteId } = await addNoteFlow(
        {
          transcript,
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
        nameEmb = await embedText(labelEmbeddingText(targetName))
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

      // Optional: Reassign category if rename changes semantics
      await assignCategoryToTopic(sourceId, store)
    })()
  }

  function handleUpdateDisplayTag(newDisplayTag: string) {
    if (!selectedTopic) return
    const sourceId = selectedTopic.id
    const trimmedTag = newDisplayTag.trim()

    store.setTopics((prev) => {
      const t = { ...prev[sourceId] } as Topic
      t.displayTag = trimmedTag
      return { ...prev, [sourceId]: t }
    })
  }

  // New: Mirror for Category
  function handleRenameCategory(newName: string) {
    if (!selectedCategory) return
    const sourceId = selectedCategory.id
    const targetName = normalizeTagName(newName)

    ;(async () => {
      let nameEmb: number[] = []
      try {
        nameEmb = await embedText(labelEmbeddingText(targetName))
      } catch {}

      store.setCategories((prev) => {
        const c = { ...prev[sourceId] } as Category
        if (c.name !== targetName) {
          if (!c.aliases.includes(c.name)) c.aliases = [...c.aliases, c.name]
          c.name = targetName
        }
        if (nameEmb.length) c.labelEmbedding = nameEmb
        return { ...prev, [sourceId]: c }
      })

      // Optional: Recompute centroid after rename
      store.setCategories((prev) => {
        const c = { ...prev[sourceId] } as Category
        const vecs = c.topicIds.map((id) => topicPrototype(store.topics[id]))
        c.embedding = averageVectors(vecs)
        return { ...prev, [sourceId]: c }
      })
    })()
  }

  // New: Mirror for Category display tag
  function handleUpdateCategoryDisplayTag(newDisplayTag: string) {
    if (!selectedCategory) return
    const sourceId = selectedCategory.id
    const trimmedTag = newDisplayTag.trim()

    store.setCategories((prev) => {
      const c = { ...prev[sourceId] } as Category
      c.displayTag = trimmedTag
      return { ...prev, [sourceId]: c }
    })
  }

  function handleClearAll() {
    if (
      !confirm(
        'Are you sure you want to clear all data from local storage? This cannot be undone.'
      )
    )
      return
    clearAllData()
    store.setTopics({})
    store.setSummaries({})
    store.setCategories({}) // Add this
    setSelectedNoteId(null)
    setCreating(true)
  }

  return (
    <div className='flex'>
      <Sidebar
        categories={store.categories} // Add this
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
        onClearAll={handleClearAll}
      />

      {creating ? (
        <NewSummarizer onCreate={handleCreate} busy={busy} error={error} />
      ) : (
        <DetailView
          note={selectedNote}
          topic={selectedTopic}
          category={selectedCategory} // Add this
          onRenameTopic={handleRenameTopic}
          onUpdateDisplayTag={handleUpdateDisplayTag}
          onRenameCategory={handleRenameCategory} // Add this
          onUpdateCategoryDisplayTag={handleUpdateCategoryDisplayTag} // Add this
        />
      )}
    </div>
  )
}
