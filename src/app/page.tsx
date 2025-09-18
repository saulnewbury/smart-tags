// app/page.tsx

'use client'

import React, { useState } from 'react'
import type { Topic, NoteSummary, CreateArgs } from '../types'
import { useStore } from '@/hooks/useStore'
import { addNoteFlow, reassignNoteToTopic } from '@/services/addNote'
import { fetchTranscript } from '@/services/transcript'
import { clearAllData } from '@/utils/storage'
import { normalizeTagName, labelEmbeddingText } from '@/utils/textProcessing'
import { embedText } from '@/utils/openai'
import { Sidebar } from '@/components/Sidebar'
import { DetailView } from '@/components/DetailView'
import { NewSummarizer } from '@/components/NewSummarizer'
import { uid } from '@/utils/storage'
import { averageVectors } from '@/utils/vectorMath'

// Cluster size constants (matching addNote.ts)
const HARD_CAP = 10

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

  async function handleCreate(args: CreateArgs) {
    setBusy(true)
    setError(null)
    try {
      // Fetch the transcript - the API now returns video_id reliably
      const transcriptData = await fetchTranscript(args.url)

      console.log(
        'Received transcript data with video ID:',
        transcriptData.videoId
      )

      // Pass all the data through to addNoteFlow
      // No need to extract video ID here - it's already in transcriptData
      const { noteId } = await addNoteFlow(
        {
          transcript: transcriptData.text,
          userPrompt: args.prompt,
          segments: transcriptData.segments,
          videoId: transcriptData.videoId, // Directly from API response
          originalUrl: args.url,
          videoTitle: transcriptData.videoTitle || 'YouTube Video'
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

  async function handleRenameTopic(newName: string) {
    if (!selectedTopic || !selectedNote) return
    const sourceId = selectedTopic.id
    const targetName = normalizeTagName(newName)

    let nameEmb: number[] = []
    try {
      nameEmb = await embedText(labelEmbeddingText(targetName))
    } catch {}

    store.setTopics((prev) => {
      const updatedTopics = { ...prev }

      if (selectedTopic.summaryIds.length === 1) {
        // Singleton topic: rename with conditional alias addition
        const t = { ...updatedTopics[sourceId] } as Topic
        const oldName = t.name
        if (t.name !== targetName) {
          const normOld = normalizeTagName(oldName)
          const normSuggested = normalizeTagName(
            selectedNote.canonicalSuggested
          )
          const isInitialSuggested = normOld === normSuggested
          const matchesExisting = Object.values(prev).some(
            (otherTopic) =>
              otherTopic.id !== sourceId &&
              normalizeTagName(otherTopic.name) === normOld
          )
          if (
            isInitialSuggested &&
            !matchesExisting &&
            !t.aliases.includes(oldName)
          ) {
            t.aliases = [...t.aliases, oldName]
          }
          t.name = targetName
        }
        if (nameEmb.length) t.labelEmbedding = nameEmb
        updatedTopics[sourceId] = t
      } else {
        // Shared topic: Instead of always splitting, check if target topic exists
        const existingTargetTopic = Object.values(updatedTopics).find(
          (t) => normalizeTagName(t.name) === targetName && t.id !== sourceId
        )

        if (existingTargetTopic) {
          // Move note to existing topic (will handle eviction if needed)
          console.log(
            `Moving note to existing topic: ${existingTargetTopic.id}`
          )
          reassignNoteToTopic(selectedNote.id, existingTargetTopic.id, store)
        } else {
          // Create new topic for this note (split from original)
          const oldTopic = { ...updatedTopics[sourceId] } as Topic

          // Create new topic
          const newTopicId = uid('topic')
          const noteEmbedding = store.summaries[selectedNote.id].embedding
          const blended = averageVectors([noteEmbedding, nameEmb])
          const newTopic: Topic = {
            id: newTopicId,
            name: targetName,
            aliases: [],
            embedding: blended,
            labelEmbedding: nameEmb,
            summaryIds: [selectedNote.id],
            displayTag: selectedTopic.displayTag // Preserve if desired, or reset
          }
          updatedTopics[newTopicId] = newTopic

          // Update old topic: remove note and recompute centroid
          oldTopic.summaryIds = oldTopic.summaryIds.filter(
            (id) => id !== selectedNote.id
          )
          const remainingVecs = oldTopic.summaryIds.map(
            (id) => store.summaries[id].embedding
          )
          oldTopic.embedding = averageVectors(
            remainingVecs.length ? remainingVecs : [oldTopic.embedding]
          ) // Fallback to current if empty
          updatedTopics[sourceId] = oldTopic

          // Update the note's topicId
          store.setSummaries((prev) => {
            const updatedSummaries = { ...prev }
            const note = { ...updatedSummaries[selectedNote.id] }
            note.topicId = newTopicId
            updatedSummaries[selectedNote.id] = note
            return updatedSummaries
          })
        }
      }

      return updatedTopics
    })
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
    setSelectedNoteId(null)
    setCreating(true)
  }

  // Helper to get topic size info for display
  function getTopicSizeInfo(topic: Topic | null) {
    if (!topic) return null
    const size = topic.summaryIds.length
    const isSoftCapped = size >= 6
    const isHardCapped = size >= HARD_CAP
    return { size, isSoftCapped, isHardCapped }
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
          onRenameTopic={handleRenameTopic}
          onUpdateDisplayTag={handleUpdateDisplayTag}
          topicSizeInfo={getTopicSizeInfo(selectedTopic)}
        />
      )}
    </div>
  )
}
