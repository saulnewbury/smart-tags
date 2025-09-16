// components/NewSummarizerWithStreaming.tsx

import React, { useState, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'

interface CreateArgs {
  url: string
  prompt: string
}

interface StreamingProgress {
  isStreaming: boolean
  summary: string
  canonical_name?: string
}

interface NewSummarizerWithStreamingProps {
  onCreate: (args: CreateArgs) => Promise<void>
  busy: boolean
  error: string | null
  streamingProgress: StreamingProgress
}

export function NewSummarizerWithStreaming(
  props: NewSummarizerWithStreamingProps
) {
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [localStreamingText, setLocalStreamingText] = useState('')

  // Update local streaming text when props change
  useEffect(() => {
    if (props.streamingProgress.isStreaming) {
      setLocalStreamingText(props.streamingProgress.summary)
    } else if (!props.busy) {
      // Clear when not busy and not streaming
      setLocalStreamingText('')
    }
  }, [props.streamingProgress, props.busy])

  const handleCreate = async () => {
    setLocalStreamingText('')
    await props.onCreate({ url, prompt })

    // Clear form on success
    if (!props.error) {
      setUrl('')
      setPrompt('')
    }
  }

  const isProcessing = props.busy || props.streamingProgress.isStreaming

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b flex items-center gap-2'>
        <div className='font-semibold'>New YouTube Video</div>
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
            disabled={isProcessing}
          />
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            YouTube URL
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='Paste a YouTube URL…'
            className='w-full border rounded-lg px-3 py-2'
            disabled={isProcessing}
          />
        </div>

        <div className='border rounded-lg p-4'>
          <div className='text-sm font-medium text-gray-700 mb-2'>
            Transcript Features
          </div>
          <div className='text-xs text-gray-500'>
            ✓ Automatic timestamps every 10-15 seconds
            <br />
            ✓ Clickable timestamps to jump to video position
            <br />
            ✓ Smart grouping at natural speech boundaries
            <br />✓ Real-time streaming summaries
          </div>
        </div>

        {/* Streaming Progress Display */}
        {props.streamingProgress.isStreaming && localStreamingText && (
          <div className='border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900'>
            <div className='text-xs uppercase text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2'>
              <Loader2 className='h-3 w-3 animate-spin' />
              <span>Generating Summary</span>
              {props.streamingProgress.canonical_name && (
                <span className='ml-auto text-blue-600 dark:text-blue-400'>
                  → {props.streamingProgress.canonical_name}
                </span>
              )}
            </div>
            <div className='relative'>
              <div className='text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:text-gray-200'>
                {localStreamingText}
                <span className='inline-block w-2 h-4 bg-blue-600 dark:bg-blue-400 animate-pulse ml-1' />
              </div>
            </div>
          </div>
        )}

        {/* Processing Status (non-streaming parts) */}
        {props.busy && !props.streamingProgress.isStreaming && (
          <div className='border rounded-lg p-4 bg-gray-50 dark:bg-gray-800'>
            <div className='text-xs uppercase text-gray-500 mb-2 flex items-center gap-2'>
              <Loader2 className='h-3 w-3 animate-spin' />
              Processing Video
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              {localStreamingText
                ? 'Creating note and organizing...'
                : 'Fetching transcript...'}
            </div>
          </div>
        )}

        {/* Error Display */}
        {props.error && (
          <div className='border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950'>
            <div className='text-sm text-red-600 dark:text-red-400'>
              {props.error}
            </div>
          </div>
        )}

        <div className='flex gap-3'>
          <button
            disabled={isProcessing || !url.trim()}
            onClick={handleCreate}
            className='inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {isProcessing ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span>
                  {props.streamingProgress.isStreaming
                    ? 'Summarizing...'
                    : 'Processing...'}
                </span>
              </>
            ) : (
              <>
                <Plus className='h-4 w-4' />
                <span>Fetch Transcript & Summarize</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
