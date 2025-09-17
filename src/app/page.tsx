// app/page.tsx - Updated with multi-topic support

'use client'

import React, { useState } from 'react'
import type { Topic, NoteSummary, CreateArgs } from '../types'
import { useStore } from '@/hooks/useStore'
import { addNoteFlow } from '@/services/addNote'
import { fetchTranscript } from '@/services/transcript'
import { clearAllData } from '@/utils/storage'
import { normalizeTagName, labelEmbeddingText } from '@/utils/textProcessing'
import { embedText } from '@/utils/openai'
import { Sidebar } from '@/components/Sidebar'
import { DetailView } from '@/components/DetailView'
import { NewSummarizer } from '@/components/NewSummarizer'
import { uid } from '@/utils/storage'
import { averageVectors } from '@/utils/vectorMath'

export default function Page() {
  const store = useStore()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedNote: NoteSummary | null = selectedNoteId
    ? store.summaries[selectedNoteId] || null
    : null
  const selectedTopic: Topic | null = selectedNote
    ? store.topics[selectedNote.topicId] || null
    : null

  // Get related notes and topics if this is part of a multi-topic video
  const getRelatedNotesAndTopics = () => {
    if (!selectedNote?.videoGroupId) {
      return { relatedNotes: [], relatedTopics: [] }
    }

    const relatedNotes = Object.values(store.summaries)
      .filter(
        (n) =>
          n.videoGroupId === selectedNote.videoGroupId &&
          n.id !== selectedNote.id &&
          !n.isPrimary // Only get secondary topics
      )
      .sort((a, b) => (b.prominence || 0) - (a.prominence || 0))

    const relatedTopics = relatedNotes
      .map((n) => store.topics[n.topicId])
      .filter(Boolean)

    return { relatedNotes, relatedTopics }
  }

  const { relatedNotes, relatedTopics } = getRelatedNotesAndTopics()

  async function handleCreate(args: CreateArgs) {
    setBusy(true)
    setError(null)
    try {
      // Fetch the transcript
      const transcriptData = await fetchTranscript(args.url)

      console.log('Creating note with multi-topic:', args.multiTopic)

      // Pass all data including multiTopic flag
      const { noteIds, topicIds } = await addNoteFlow(
        {
          transcript: transcriptData.text,
          userPrompt: args.prompt,
          segments: transcriptData.segments,
          videoId: transcriptData.videoId,
          originalUrl: args.url,
          videoTitle: transcriptData.videoTitle || 'YouTube Video',
          multiTopic: args.multiTopic || false
        },
        store
      )

      setCreating(false)
      // Select the primary note (first one)
      setSelectedNoteId(noteIds[0])

      if (args.multiTopic && noteIds.length > 1) {
        console.log(
          `Created ${noteIds.length} notes across ${
            new Set(topicIds).size
          } topics`
        )
      }
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleRenameTopic(newName: string, topicId?: string) {
    const targetTopicId = topicId || selectedTopic?.id
    if (!targetTopicId || !selectedNote) return

    const targetTopic = store.topics[targetTopicId]
    if (!targetTopic) return

    const targetName = normalizeTagName(newName)

    let nameEmb: number[] = []
    try {
      nameEmb = await embedText(labelEmbeddingText(targetName))
    } catch {}

    store.setTopics((prev) => {
      const updatedTopics = { ...prev }
      const topic = { ...updatedTopics[targetTopicId] } as Topic

      if (topic.summaryIds.length === 1) {
        // Singleton topic: simple rename
        const oldName = topic.name
        if (topic.name !== targetName) {
          const normOld = normalizeTagName(oldName)
          const matchesExisting = Object.values(prev).some(
            (otherTopic) =>
              otherTopic.id !== targetTopicId &&
              normalizeTagName(otherTopic.name) === normOld
          )
          if (!matchesExisting && !topic.aliases.includes(oldName)) {
            topic.aliases = [...topic.aliases, oldName]
          }
          topic.name = targetName
        }
        if (nameEmb.length) topic.labelEmbedding = nameEmb
        updatedTopics[targetTopicId] = topic
      } else {
        // Shared topic: split by creating new topic for this note
        const noteToMove = store.summaries[selectedNote.id]

        // Create new topic
        const newTopicId = uid('topic')
        const noteEmbedding = noteToMove.embedding
        const blended = averageVectors([noteEmbedding, nameEmb])
        const newTopic: Topic = {
          id: newTopicId,
          name: targetName,
          aliases: [],
          embedding: blended,
          labelEmbedding: nameEmb,
          summaryIds: [selectedNote.id],
          displayTag: topic.displayTag
        }
        updatedTopics[newTopicId] = newTopic

        // Update old topic: remove note and recompute centroid
        topic.summaryIds = topic.summaryIds.filter(
          (id) => id !== selectedNote.id
        )
        const remainingVecs = topic.summaryIds.map(
          (id) => store.summaries[id].embedding
        )
        topic.embedding = averageVectors(
          remainingVecs.length ? remainingVecs : [topic.embedding]
        )
        updatedTopics[targetTopicId] = topic

        // Update the note's topicId
        store.setSummaries((prev) => {
          const updatedSummaries = { ...prev }
          const note = { ...updatedSummaries[selectedNote.id] }
          note.topicId = newTopicId
          updatedSummaries[selectedNote.id] = note
          return updatedSummaries
        })
      }

      return updatedTopics
    })
  }

  function handleUpdateDisplayTag(newDisplayTag: string, topicId?: string) {
    const targetTopicId = topicId || selectedTopic?.id
    if (!targetTopicId) return

    const trimmedTag = newDisplayTag.trim()

    store.setTopics((prev) => {
      const t = { ...prev[targetTopicId] } as Topic
      t.displayTag = trimmedTag
      return { ...prev, [targetTopicId]: t }
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
          relatedNotes={relatedNotes}
          relatedTopics={relatedTopics}
          onRenameTopic={handleRenameTopic}
          onUpdateDisplayTag={handleUpdateDisplayTag}
        />
      )}
    </div>
  )
}
