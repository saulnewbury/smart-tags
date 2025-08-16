// components/DetailView.tsx

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import type { Category, Topic, NoteSummary } from '../types'

interface DetailViewProps {
  note: NoteSummary | null
  topic: Topic | null
  category: Category | null
  onRenameTopic: (newName: string) => void
  onUpdateDisplayTag: (newDisplayTag: string) => void
  onRenameCategory: (newName: string) => void
  onUpdateCategoryDisplayTag: (newDisplayTag: string) => void
  onResummarize?: () => void
}

export function DetailView(props: DetailViewProps) {
  const [topicFingerprint, setTopicFingerprint] = useState(
    props.topic?.name ?? ''
  )
  const [topicDisplayTag, setTopicDisplayTag] = useState(
    props.topic?.displayTag ?? ''
  )
  const [categoryFingerprint, setCategoryFingerprint] = useState(
    props.category?.name ?? ''
  )
  const [categoryDisplayTag, setCategoryDisplayTag] = useState(
    props.category?.displayTag ?? ''
  )

  useEffect(() => {
    setTopicFingerprint(props.topic?.name ?? '')
    setTopicDisplayTag(props.topic?.displayTag ?? '')
    setCategoryFingerprint(props.category?.name ?? '')
    setCategoryDisplayTag(props.category?.displayTag ?? '')
  }, [props.topic, props.category])

  if (!props.note || !props.topic) {
    return (
      <div className='flex-1 h-screen flex items-center justify-center text-gray-500'>
        Select a summary from the left, or create a new one.
      </div>
    )
  }

  return (
    <div className='flex-1 h-screen overflow-y-auto'>
      <div className='p-4 border-b space-y-3'>
        {props.category && (
          <>
            <div className='flex items-center gap-2'>
              <div className='flex-1'>
                <div className='text-xs uppercase text-gray-500 mb-1'>
                  Category Semantic Fingerprint
                </div>
                <input
                  value={categoryFingerprint}
                  onChange={(e) => setCategoryFingerprint(e.target.value)}
                  className='w-full border rounded-lg px-3 py-2'
                  placeholder='Semantic fingerprint for AI matching...'
                />
              </div>
              <button
                onClick={() => props.onRenameCategory(categoryFingerprint)}
                className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
              >
                <Save className='h-4 w-4' /> Save Category Fingerprint
              </button>
            </div>

            <div className='flex items-center gap-2'>
              <div className='flex-1'>
                <div className='text-xs uppercase text-gray-500 mb-1'>
                  Category Display Tag
                </div>
                <input
                  value={categoryDisplayTag}
                  onChange={(e) => setCategoryDisplayTag(e.target.value)}
                  className='w-full border rounded-lg px-3 py-2'
                  placeholder='Human-readable tag for organization...'
                />
              </div>
              <button
                onClick={() =>
                  props.onUpdateCategoryDisplayTag(categoryDisplayTag)
                }
                className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
              >
                <Save className='h-4 w-4' /> Save Category Tag
              </button>
            </div>
          </>
        )}

        <div className='flex items-center gap-2'>
          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Topic Semantic Fingerprint
            </div>
            <input
              value={topicFingerprint}
              onChange={(e) => setTopicFingerprint(e.target.value)}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Semantic fingerprint for AI matching...'
            />
          </div>
          <button
            onClick={() => props.onRenameTopic(topicFingerprint)}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
          >
            <Save className='h-4 w-4' /> Save Topic Fingerprint
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex-1'>
            <div className='text-xs uppercase text-gray-500 mb-1'>
              Topic Display Tag
            </div>
            <input
              value={topicDisplayTag}
              onChange={(e) => setTopicDisplayTag(e.target.value)}
              className='w-full border rounded-lg px-3 py-2'
              placeholder='Human-readable tag for organization...'
            />
          </div>
          <button
            onClick={() => props.onUpdateDisplayTag(topicDisplayTag)}
            className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 mt-5'
          >
            <Save className='h-4 w-4' /> Save Topic Tag
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
        {props.category && (
          <div>
            <div className='text-xs uppercase text-gray-500 mb-2'>
              Category Semantic Fingerprint
            </div>
            <div className='text-lg font-semibold'>{props.category.name}</div>
            {props.category.aliases.length > 0 && (
              <div className='text-xs text-gray-500 mt-1'>
                Aliases: {props.category.aliases.join(', ')}
              </div>
            )}
            <div className='text-xs uppercase text-gray-500 mb-2 mt-4'>
              Category Display Tag
            </div>
            <div className='text-lg font-semibold text-purple-600'>
              {props.category.displayTag}
            </div>
          </div>
        )}

        <div>
          <div className='text-xs uppercase text-gray-500 mb-2'>
            Topic Semantic Fingerprint
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
            Topic Display Tag
          </div>
          <div className='text-lg font-semibold text-blue-600'>
            {props.topic.displayTag}
          </div>
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
