// app/page.tsx

'use client'

import React, { useState } from 'react'
import type { Topic, NoteSummary, SuperCategory, CreateArgs } from '../types'
import { useStore } from '@/hooks/useStore'
import { addNoteFlow } from '@/services/addNote'
import { fetchTranscript } from '@/services/transcript'
import { clearAllData } from '@/utils/storage'
import { clearSuperCategories } from '@/utils/superCategoryStorage'
import { normalizeTagName, labelEmbeddingText } from '@/utils/textProcessing'
import { embedText } from '@/utils/openai'
import { createSuperCategory } from '@/services/superCategory'
import { uid } from '@/utils/storage'
import { Sidebar } from '@/components/Sidebar'
import { DetailView } from '@/components/DetailView'
import { NewSummarizer } from '@/components/NewSummarizer'

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
  const selectedSuperCategory: SuperCategory | null =
    selectedTopic?.superCategoryId
      ? store.superCategories[selectedTopic.superCategoryId] || null
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

  function handleUpdateSuperCategory(superCategoryId: string | null) {
    if (!selectedTopic) return
    const topicId = selectedTopic.id

    store.setTopics((prev) => {
      const t = { ...prev[topicId] } as Topic
      t.superCategoryId = superCategoryId
      return { ...prev, [topicId]: t }
    })
  }

  async function handleCreateSuperCategory(
    name: string,
    displayTag: string
  ): Promise<string> {
    const superCategory = await createSuperCategory(name, displayTag)
    const superCategoryId = superCategory.id

    store.setSuperCategories((prev) => ({
      ...prev,
      [superCategoryId]: superCategory
    }))

    return superCategoryId
  }

  function handleClearAll() {
    if (
      !confirm(
        'Are you sure you want to clear all data from local storage? This cannot be undone.'
      )
    )
      return
    clearAllData()
    clearSuperCategories()
    store.setTopics({})
    store.setSummaries({})
    store.setSuperCategories({})
    setSelectedNoteId(null)
    setCreating(true)
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
        onClearAll={handleClearAll}
      />

      {creating ? (
        <NewSummarizer onCreate={handleCreate} busy={busy} error={error} />
      ) : (
        <DetailView
          note={selectedNote}
          topic={selectedTopic}
          superCategory={selectedSuperCategory}
          superCategories={store.superCategories}
          onRenameTopic={handleRenameTopic}
          onUpdateDisplayTag={handleUpdateDisplayTag}
          onUpdateSuperCategory={handleUpdateSuperCategory}
          onCreateSuperCategory={handleCreateSuperCategory}
        />
      )}
    </div>
  )
}
