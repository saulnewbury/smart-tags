// components/DetailView.tsx - Simplified version

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, ExternalLink } from 'lucide-react'
import type { Topic, NoteSummary } from '../types'
import { ClickableTranscript } from './ClickableTranscript'
import { parseYouTubeUrl } from '@/utils/youtube'

interface DetailViewProps {
  note: NoteSummary | null
  topic: Topic | null
  onRenameTopic: (newName: string) => void
  onUpdateDisplayTag: (newDisplayTag: string) => void
  onResummarize?: () => void
}

export function DetailView(props: DetailViewProps) {
  const [fingerprint, setFingerprint] = useState(props.topic?.name ?? '')
  const [displayTag, setDisplayTag] = useState(props.topic?.displayTag ?? '')
  const [viewMode, setViewMode] = useState<'summary' | 'transcript'>('summary')

  useEffect(() => {
    setFingerprint(props.topic?.name ?? '')
    setDisplayTag(props.topic?.displayTag ?? '')
  }, [props.topic])

  if (!props.note || !props.topic) {
    return (
      <div className='flex-1 h-screen flex items-center justify-center text-gray-500'>
        Select a summary from the left, or create a new one.
      </div>
    )
  }

  // Video ID should already be in the note data
  const videoId = props.note.videoId
  const videoUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : props.note.originalUrl

  console.log('DetailView - Video info:', {
    videoId,
    originalUrl: props.note.originalUrl,
    videoTitle: props.note.videoTitle
  })

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Semantic Fingerprint
            </div>
            <input
              value={fingerprint}
              onChange={(e) => setFingerprint(e.target.value)}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Semantic fingerprint for AI matching...'
            />
          </div>
          <button
            onClick={() => props.onRenameTopic(fingerprint)}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
          >
            <Save className='h-4 w-4' /> Save Fingerprint
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Display Tag
            </div>
            <input
              value={displayTag}
              onChange={(e) => setDisplayTag(e.target.value)}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Human-readable tag for organization...'
            />
          </div>
          <button
            onClick={() => props.onUpdateDisplayTag(displayTag)}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
          >
            <Save className='h-4 w-4' /> Save Tag
          </button>
        </div>

        {props.onResummarize && (
          <div className='flex justify-end'>
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
        {/* Video info section if available */}
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
          </div>
        )}

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Semantic Fingerprint
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
            Display Tag
          </div>
          <div className='text-lg font-semibold text-blue-600'>
            {props.topic.displayTag || props.topic.name}
          </div>
        </div>

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
              <pre className='whitespace-pre-wrap text-sm leading-6'>
                {props.note.summary}
              </pre>
            ) : (
              <ClickableTranscript
                text={props.note.transcript}
                videoId={videoId}
              />
            )}
          </div>
        </div>

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
