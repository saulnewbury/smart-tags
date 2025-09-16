// app/page.tsx

'use client'

import React, { useState } from 'react'
import type { Topic, NoteSummary, CreateArgs } from '../types'
import { useStore } from '@/hooks/useStore'
import { addNoteFlowWithStreaming } from '@/services/addNoteFlowWithStreaming'
import { fetchTranscript } from '@/services/transcript'
import { clearAllData } from '@/utils/storage'
import { normalizeTagName, labelEmbeddingText } from '@/utils/textProcessing'
import { embedText } from '@/utils/openai'
import { Sidebar } from '@/components/Sidebar'
import { DetailView } from '@/components/DetailView'
import { NewSummarizerWithStreaming } from '@/components/NewSummarizerWithStreaming'
import { uid } from '@/utils/storage'
import { averageVectors } from '@/utils/vectorMath'

export default function Page() {
  const store = useStore()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(true) // start on creator view
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Streaming progress state
  const [streamingProgress, setStreamingProgress] = useState<{
    isStreaming: boolean
    summary: string
    canonical_name?: string
  }>({ isStreaming: false, summary: '' })

  const selectedNote: NoteSummary | null = selectedNoteId
    ? store.summaries[selectedNoteId] || null
    : null
  const selectedTopic: Topic | null = selectedNote
    ? store.topics[selectedNote.topicId] || null
    : null

  async function handleCreate(args: CreateArgs) {
    setBusy(true)
    setError(null)
    setStreamingProgress({ isStreaming: false, summary: '' })

    try {
      // Fetch the transcript (timestamps are now always included)
      const transcriptData = await fetchTranscript(args.url)

      console.log('Received transcript data:', transcriptData) // Debug log

      // Use video ID from API response, or extract as fallback
      let videoId = transcriptData.videoId
      if (!videoId) {
        // Fallback: extract video ID from URL
        const extractVideoId = (url: string): string | null => {
          const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/,
            /youtube\.com\/v\/([^&\n?#]+)/
          ]

          for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) return match[1]
          }
          return null
        }
        videoId = extractVideoId(args.url)
      }

      console.log('Final video data being passed to addNoteFlow:', {
        videoId,
        originalUrl: args.url,
        videoTitle: transcriptData.videoTitle
      }) // Debug log

      // Now proceed with summarization using the streaming version
      const { noteId } = await addNoteFlowWithStreaming(
        {
          transcript: transcriptData.text,
          userPrompt: args.prompt,
          segments: transcriptData.segments,
          // Pass video information for clickable timestamps
          videoId: videoId || undefined,
          originalUrl: args.url,
          videoTitle: transcriptData.videoTitle || 'YouTube Video'
        },
        store,
        {
          onStreamStart: () => {
            console.log('Streaming started')
            setStreamingProgress({ isStreaming: true, summary: '' })
          },
          onStreamToken: (token) => {
            // This is called for each token - could be used for character animation
            // For now, we'll rely on onStreamPartial for better performance
          },
          onStreamPartial: (partial) => {
            // Update the streaming progress with partial summary
            setStreamingProgress((prev) => ({
              ...prev,
              summary: partial.summary || prev.summary,
              canonical_name: partial.canonical_name || prev.canonical_name
            }))
          },
          onStreamComplete: () => {
            console.log('Streaming complete')
            setStreamingProgress((prev) => ({ ...prev, isStreaming: false }))
          },
          onStreamError: (error) => {
            console.error('Streaming error:', error)
            setError(error.message)
            setStreamingProgress({ isStreaming: false, summary: '' })
          }
        }
      )

      setCreating(false)
      setSelectedNoteId(noteId)
      // Clear streaming progress after successful creation
      setStreamingProgress({ isStreaming: false, summary: '' })
    } catch (e: any) {
      setError(e.message || String(e))
      setStreamingProgress({ isStreaming: false, summary: '' })
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
        // Shared topic: split by creating new topic and moving the selected note
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
      }

      return updatedTopics
    })

    // If split occurred, update the note's topicId (do this after topics update)
    if (selectedTopic.summaryIds.length > 1) {
      const newTopicId = Object.keys(store.topics).find(
        (id) =>
          store.topics[id].summaryIds.includes(selectedNote.id) &&
          id !== sourceId
      )
      if (newTopicId) {
        store.setSummaries((prev) => {
          const updatedSummaries = { ...prev }
          const note = { ...updatedSummaries[selectedNote.id] }
          note.topicId = newTopicId
          updatedSummaries[selectedNote.id] = note
          return updatedSummaries
        })
      }
    }
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
        <NewSummarizerWithStreaming
          onCreate={handleCreate}
          busy={busy}
          error={error}
          streamingProgress={streamingProgress}
        />
      ) : (
        <DetailView
          note={selectedNote}
          topic={selectedTopic}
          onRenameTopic={handleRenameTopic}
          onUpdateDisplayTag={handleUpdateDisplayTag}
        />
      )}
    </div>
  )
}
