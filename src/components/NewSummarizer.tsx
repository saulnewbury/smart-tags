// components/NewSummarizer.tsx

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import type { CreateArgs } from '../types'

interface NewSummarizerProps {
  onCreate: (args: CreateArgs) => Promise<void>
  busy: boolean
  error: string | null
}

export function NewSummarizer(props: NewSummarizerProps) {
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')

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
          />
        </div>

        {props.error && (
          <div className='text-sm text-red-600'>{props.error}</div>
        )}

        <div className='flex gap-3'>
          <button
            disabled={props.busy || !url.trim()}
            onClick={() => props.onCreate({ url, prompt })}
            className='inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50'
          >
            <Plus className='h-4 w-4' /> Fetch Transcript & Summarize
          </button>
        </div>
      </div>
    </div>
  )
}
