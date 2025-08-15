// components/DetailView.tsx

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Layers } from 'lucide-react'
import type { Topic, NoteSummary, SuperCategory } from '../types'

interface DetailViewProps {
  note: NoteSummary | null
  topic: Topic | null
  superCategory: SuperCategory | null
  superCategories: Record<string, SuperCategory>
  onRenameTopic: (newName: string) => void
  onUpdateDisplayTag: (newDisplayTag: string) => void
  onUpdateSuperCategory: (superCategoryId: string | null) => void
  onCreateSuperCategory: (name: string, displayTag: string) => Promise<string>
  onResummarize?: () => void
}

export function DetailView(props: DetailViewProps) {
  const [fingerprint, setFingerprint] = useState(props.topic?.name ?? '')
  const [displayTag, setDisplayTag] = useState(props.topic?.displayTag ?? '')
  const [superFingerprint, setSuperFingerprint] = useState('')
  const [superDisplayTag, setSuperDisplayTag] = useState('')
  const [selectedSuperCategoryId, setSelectedSuperCategoryId] = useState<
    string | null
  >(null)
  const [showCreateSuper, setShowCreateSuper] = useState(false)

  useEffect(() => {
    setFingerprint(props.topic?.name ?? '')
    setDisplayTag(props.topic?.displayTag ?? '')
    setSelectedSuperCategoryId(props.topic?.superCategoryId ?? null)

    // Reset super category creation fields
    setSuperFingerprint('')
    setSuperDisplayTag('')
    setShowCreateSuper(false)
  }, [props.topic])

  const handleCreateSuperCategory = async () => {
    if (!superFingerprint.trim() || !superDisplayTag.trim()) return

    try {
      const newSuperCategoryId = await props.onCreateSuperCategory(
        superFingerprint,
        superDisplayTag
      )
      setSelectedSuperCategoryId(newSuperCategoryId)
      props.onUpdateSuperCategory(newSuperCategoryId)
      setShowCreateSuper(false)
      setSuperFingerprint('')
      setSuperDisplayTag('')
    } catch (error) {
      console.error('Failed to create super category:', error)
    }
  }

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

        <div className='border-t pt-3'>
          <div className='flex items-center gap-2 mb-2'>
            <Layers className='h-4 w-4' />
            <div className='text-xs uppercase text-gray-500'>
              Super Category
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <select
              value={selectedSuperCategoryId || ''}
              onChange={(e) => {
                const value = e.target.value || null
                setSelectedSuperCategoryId(value)
                props.onUpdateSuperCategory(value)
              }}
              className='flex-1 border rounded-lg px-3 py-2'
            >
              <option value=''>No super category</option>
              {Object.values(props.superCategories).map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.displayTag} ({sc.name})
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowCreateSuper(!showCreateSuper)}
              className='inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800'
            >
              <Layers className='h-4 w-4' /> New
            </button>
          </div>

          {showCreateSuper && (
            <div className='mt-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 space-y-2'>
              <div>
                <div className='text-xs text-gray-500 mb-1'>
                  Super Category Fingerprint
                </div>
                <input
                  value={superFingerprint}
                  onChange={(e) => setSuperFingerprint(e.target.value)}
                  className='w-full border rounded px-2 py-1 text-sm'
                  placeholder='e.g., politics, technology, science...'
                />
              </div>
              <div>
                <div className='text-xs text-gray-500 mb-1'>
                  Super Category Display Tag
                </div>
                <input
                  value={superDisplayTag}
                  onChange={(e) => setSuperDisplayTag(e.target.value)}
                  className='w-full border rounded px-2 py-1 text-sm'
                  placeholder='e.g., Politics & Current Events, Tech News...'
                />
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={handleCreateSuperCategory}
                  disabled={!superFingerprint.trim() || !superDisplayTag.trim()}
                  className='inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50'
                >
                  <Save className='h-3 w-3' /> Create & Assign
                </button>
                <button
                  onClick={() => setShowCreateSuper(false)}
                  className='text-xs text-gray-500 hover:text-gray-700 px-2 py-1'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {props.onResummarize && (
          <div className='flex justify-end pt-2 border-t'>
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
        {props.superCategory && (
          <div>
            <div className='text-xs uppercase text-gray-500 mb-2'>
              Super Category
            </div>
            <div className='flex items-center gap-3'>
              <div
                className='w-4 h-4 rounded'
                style={{
                  backgroundColor: props.superCategory.color || '#6B7280'
                }}
              />
              <div>
                <div className='text-lg font-semibold text-purple-600'>
                  {props.superCategory.displayTag}
                </div>
                <div className='text-sm text-gray-500'>
                  Fingerprint: {props.superCategory.name}
                </div>
              </div>
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
