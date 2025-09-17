// components/NewSummarizer.tsx

import React, { useState } from 'react'
import { Plus, Layers } from 'lucide-react'

interface CreateArgs {
  url: string
  prompt: string
  multiTopic?: boolean
}

interface NewSummarizerProps {
  onCreate: (args: CreateArgs) => Promise<void>
  busy: boolean
  error: string | null
}

export function NewSummarizer(props: NewSummarizerProps) {
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [multiTopic, setMultiTopic] = useState(true)

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b flex items-center gap-2'>
        <div className='font-semibold'>New YouTube Video</div>
      </div>

      <div className='p-6 space-y-6'>
        {/* <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Optional prompt
          </div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g., Focus on actors and outcomes; 5 bullets'
            className='w-full border rounded-lg px-3 py-2'
          />
        </div> */}

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            YouTube URL
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='Paste a YouTube URL…'
            className='w-full border rounded-lg px-3 py-2'
          />
        </div>

        <div className='border rounded-lg p-4 bg-gray-50 dark:bg-gray-800'>
          <label className='flex items-start gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={multiTopic}
              onChange={(e) => setMultiTopic(e.target.checked)}
              className='mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
            />
            <div className='flex-1'>
              <div className='flex items-center gap-2'>
                <Layers className='h-4 w-4 text-blue-600' />
                <span className='font-medium text-sm'>
                  Uncover Additional Topics
                </span>
              </div>
              <div className='text-xs text-gray-600 dark:text-gray-400 mt-1'>
                Identify multiple distinct topics within the video. Each
                significant topic will create its own summary and cluster,
                allowing for more precise organization. Best for videos covering
                diverse subjects.
              </div>
              {multiTopic && (
                <div className='mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300'>
                  ✓ AI will identify up to 3 distinct topics if they exist
                  <br />
                  ✓ Each topic gets its own fingerprint and clustering
                  <br />✓ Topics must be substantially discussed (20% of
                  content)
                </div>
              )}
            </div>
          </label>
        </div>

        <div className='border rounded-lg p-4'>
          <div className='text-sm font-medium text-gray-700 mb-2'>
            Transcript Features
          </div>
          <div className='text-xs text-gray-500'>
            ✓ Automatic timestamps every 10-15 seconds
            <br />
            ✓ Clickable timestamps to jump to video position
            <br />✓ Smart grouping at natural speech boundaries
            {multiTopic && (
              <>
                <br />✓ Multiple topic extraction for complex videos
              </>
            )}
          </div>
        </div>

        {props.error && (
          <div className='text-sm text-red-600'>{props.error}</div>
        )}

        <div className='flex gap-3'>
          <button
            disabled={props.busy || !url.trim()}
            onClick={() => props.onCreate({ url, prompt, multiTopic })}
            className='inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50'
          >
            <Plus className='h-4 w-4' />
            {props.busy ? 'Processing...' : 'Fetch Transcript & Summarize'}
          </button>
        </div>
      </div>
    </div>
  )
}
