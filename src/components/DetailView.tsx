// components/DetailView.tsx - Updated with multi-topic support

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, ExternalLink, Layers } from 'lucide-react'
import type { Topic, NoteSummary } from '../types'
import { ClickableTranscript } from './ClickableTranscript'
import { parseYouTubeUrl } from '@/utils/youtube'

interface DetailViewProps {
  note: NoteSummary | null
  topic: Topic | null
  relatedNotes?: NoteSummary[] // For multi-topic: other notes from same video
  relatedTopics?: Topic[] // For multi-topic: other topics from same video
  onRenameTopic: (newName: string, topicId?: string) => void
  onUpdateDisplayTag: (newDisplayTag: string, topicId?: string) => void
  onResummarize?: () => void
}

interface TopicRow {
  topicId: string
  fingerprint: string
  displayTag: string
  isSecondary?: boolean
  prominence?: number
}

export function DetailView(props: DetailViewProps) {
  const [primaryRow, setPrimaryRow] = useState<TopicRow | null>(null)
  const [secondaryRows, setSecondaryRows] = useState<TopicRow[]>([])
  const [viewMode, setViewMode] = useState<'summary' | 'transcript'>('summary')

  // Initialize or update topic rows when props change
  useEffect(() => {
    if (props.topic) {
      setPrimaryRow({
        topicId: props.topic.id,
        fingerprint: props.topic.name,
        displayTag: props.topic.displayTag ?? '',
        prominence: props.note?.prominence
      })
    }

    // If we have related topics (multi-topic scenario)
    if (props.relatedTopics && props.relatedTopics.length > 0) {
      setSecondaryRows(
        props.relatedTopics.map((topic, idx) => ({
          topicId: topic.id,
          fingerprint: topic.name,
          displayTag: topic.displayTag ?? '',
          isSecondary: true,
          prominence: props.relatedNotes?.[idx]?.prominence
        }))
      )
    } else {
      setSecondaryRows([])
    }
  }, [props.topic, props.relatedTopics, props.note, props.relatedNotes])

  if (!props.note || !props.topic) {
    return (
      <div className='flex-1 h-screen flex items-center justify-center text-gray-500'>
        Select a summary from the left, or create a new one.
      </div>
    )
  }

  const videoId = props.note.videoId
  const videoUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : props.note.originalUrl
  const isMultiTopic = secondaryRows.length > 0

  const handleSaveRow = (row: TopicRow) => {
    props.onRenameTopic(row.fingerprint, row.topicId)
    props.onUpdateDisplayTag(row.displayTag, row.topicId)

    // Update local state to reflect saved values
    if (row.topicId === primaryRow?.topicId) {
      setPrimaryRow({ ...row })
    } else {
      setSecondaryRows((rows) =>
        rows.map((r) => (r.topicId === row.topicId ? { ...row } : r))
      )
    }
  }

  const renderTopicRow = (row: TopicRow, index: number = 0) => {
    const updateRow = (updates: Partial<TopicRow>) => {
      if (row.topicId === primaryRow?.topicId) {
        setPrimaryRow({ ...row, ...updates })
      } else {
        setSecondaryRows((rows) =>
          rows.map((r) =>
            r.topicId === row.topicId ? { ...r, ...updates } : r
          )
        )
      }
    }

    return (
      <div
        key={row.topicId}
        className={`
          border rounded-lg p-4 
          ${
            row.isSecondary
              ? 'bg-gray-50 dark:bg-gray-800'
              : 'bg-white dark:bg-gray-900'
          }
        `}
      >
        {row.isSecondary && (
          <div className='text-xs uppercase text-gray-500 mb-3 flex items-center gap-2'>
            <Layers className='h-3 w-3' />
            Secondary Topic {index}
            {row.prominence && (
              <span className='text-gray-400'>
                ({Math.round(row.prominence)}% of content)
              </span>
            )}
          </div>
        )}

        {!row.isSecondary && isMultiTopic && (
          <div className='text-xs uppercase text-gray-500 mb-3 flex items-center gap-2'>
            <Layers className='h-3 w-3' />
            Primary Topic
            {row.prominence && (
              <span className='text-gray-400'>
                ({Math.round(row.prominence)}% of content)
              </span>
            )}
          </div>
        )}

        <div className='flex gap-3 items-end'>
          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Semantic Fingerprint
            </div>
            <input
              value={row.fingerprint}
              onChange={(e) => updateRow({ fingerprint: e.target.value })}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Semantic fingerprint for AI matching...'
            />
          </div>

          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Display Tag
            </div>
            <input
              value={row.displayTag}
              onChange={(e) => updateRow({ displayTag: e.target.value })}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Human-readable tag...'
            />
          </div>

          <button
            onClick={() => handleSaveRow(row)}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800'
          >
            <Save className='h-4 w-4' /> Save Both
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b space-y-3'>
        {primaryRow && renderTopicRow(primaryRow)}
        {secondaryRows.map((row, idx) => renderTopicRow(row, idx + 1))}

        {props.onResummarize && (
          <div className='flex justify-end pt-2'>
            <button
              onClick={props.onResummarize}
              className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50'
            >
              <RefreshCw className='h-4 w-4' /> Re-summarize
            </button>
          </div>
        )}
      </div>

      <div className='p-6 space-y-6'>
        {/* Video info section */}
        {(props.note.videoTitle || videoUrl) && (
          <div className='bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border'>
            <div className='text-xs uppercase text-gray-500 mb-2'>
              Source Video
            </div>
            <div className='flex items-start justify-between'>
              <div>
                {props.note.videoTitle && (
                  <div className='font-medium text-sm mb-1'>
                    {props.note.videoTitle}
                  </div>
                )}
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1'
                  >
                    Open in YouTube <ExternalLink className='h-3 w-3' />
                  </a>
                )}
              </div>
              {!videoId && (
                <div className='text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded'>
                  Video ID missing - timestamps not clickable
                </div>
              )}
            </div>
            {isMultiTopic && (
              <div className='mt-2 pt-2 border-t text-xs text-gray-600'>
                <Layers className='h-3 w-3 inline mr-1' />
                This video contains {secondaryRows.length + 1} distinct topics
              </div>
            )}
          </div>
        )}

        {/* Current topic info */}
        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Current Topic: Semantic Fingerprint
          </div>
          <div className='text-lg font-semibold'>{props.topic.name}</div>
          {props.topic.aliases.length > 0 && (
            <div className='text-xs text-gray-500 mt-1'>
              Aliases: {props.topic.aliases.join(', ')}
            </div>
          )}
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Current Topic: Display Tag
          </div>
          <div className='text-lg font-semibold text-blue-600'>
            {props.topic.displayTag || props.topic.name}
          </div>
        </div>

        {/* View mode toggle and content */}
        <div>
          <div className='flex gap-2 mb-2'>
            <button
              onClick={() => setViewMode('summary')}
              className={`text-xs uppercase px-3 py-1 rounded-md ${
                viewMode === 'summary'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('transcript')}
              className={`text-xs uppercase px-3 py-1 rounded-md ${
                viewMode === 'transcript'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Transcript {videoId ? '(clickable timestamps)' : ''}
            </button>
          </div>

          <div className='bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border'>
            {viewMode === 'summary' ? (
              <div>
                <pre className='whitespace-pre-wrap text-sm leading-6'>
                  {props.note.summary}
                </pre>
                {/* Show other topic summaries if in multi-topic mode */}
                {isMultiTopic && props.relatedNotes && (
                  <div className='mt-6 pt-4 border-t space-y-4'>
                    <div className='text-xs uppercase text-gray-500'>
                      Other Topics from This Video:
                    </div>
                    {props.relatedNotes.map((note, idx) => (
                      <div
                        key={note.id}
                        className='pl-4 border-l-2 border-gray-300'
                      >
                        <div className='text-sm font-medium mb-1'>
                          {secondaryRows[idx]?.fingerprint}
                        </div>
                        <pre className='whitespace-pre-wrap text-sm leading-5 text-gray-600'>
                          {note.summary}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ClickableTranscript
                text={props.note.transcript}
                videoId={videoId}
              />
            )}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>Keywords</div>
          <div className='flex flex-wrap gap-2'>
            {props.note.keywords.map((k, i) => (
              <span
                key={i}
                className='text-xs border rounded-full px-2 py-1 bg-white dark:bg-gray-800'
              >
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Categories */}
        {props.note.subjects && props.note.subjects.length > 0 && (
          <>
            <div>
              <div className='text-xs uppercase text-gray-500 mb-2'>
                Primary Super Category
              </div>
              <div className='flex flex-wrap gap-2'>
                <span className='text-xs border rounded-full px-2 py-1 bg-white dark:bg-gray-800 text-purple-600 font-semibold'>
                  {props.note.subjects[0]}
                </span>
              </div>
            </div>

            {props.note.subjects.length > 1 && (
              <div>
                <div className='text-xs uppercase text-gray-500 mb-2'>
                  Secondary Super Categories
                </div>
                <div className='flex flex-wrap gap-2'>
                  {props.note.subjects.slice(1).map((s, i) => (
                    <span
                      key={i}
                      className='text-xs border rounded-full px-2 py-1 bg-white dark:bg-gray-800 text-purple-600'
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
