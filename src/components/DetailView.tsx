// components/DetailView.tsx

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import type { Topic, NoteSummary } from '../types'

interface DetailViewProps {
  note: NoteSummary | null
  topic: Topic | null
  onRenameTopic: (newName: string) => void
  onResummarize?: () => void
}

export function DetailView(props: DetailViewProps) {
  const [name, setName] = useState(props.topic?.name ?? '')

  useEffect(() => setName(props.topic?.name ?? ''), [props.topic])

  if (!props.note || !props.topic) {
    return (
      <div className='flex-1 h-screen flex items-center justify-center text-gray-500'>
        Select a summary from the left, or create a new one.
      </div>
    )
  }

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b flex items-center gap-2'>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='flex-1 border rounded-lg px-3 py-2'
        />
        <button
          onClick={() => props.onRenameTopic(name)}
          className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800'
        >
          <Save className='h-4 w-4' /> Save Tag Name
        </button>
        {props.onResummarize && (
          <button
            onClick={props.onResummarize}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50'
          >
            <RefreshCw className='h-4 w-4' /> Re-summarize
          </button>
        )}
      </div>

      <div className='p-6 space-y-6'>
        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Canonical Tag
          </div>
          <div className='text-lg font-semibold'>{props.topic.name}</div>
          {props.topic.aliases.length > 0 && (
            <div className='text-xs text-gray-500 mt-1'>
              Aliases: {props.topic.aliases.join(', ')}
            </div>
          )}
        </div>

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>Summary</div>
          <pre className='whitespace-pre-wrap text-sm leading-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border'>
            {props.note.summary}
          </pre>
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
      </div>
    </div>
  )
}
