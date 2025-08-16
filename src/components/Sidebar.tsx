// components/Sidebar.tsx

import React, { useMemo } from 'react'
import { Plus, Tag, Trash } from 'lucide-react'
import type { Category, Topic, NoteSummary } from '../types'
import { trimTitle } from '../utils/textProcessing'

interface SidebarProps {
  categories?: Record<string, Category>
  topics?: Record<string, Topic>
  summaries?: Record<string, NoteSummary>
  onSelectNote: (id: string) => void
  onCreateNew: () => void
  onClearAll: () => void
  selectedNoteId?: string | null
}

export function Sidebar(props: SidebarProps) {
  const categoryGroups = useMemo(() => {
    const out: {
      category:
        | Category
        | {
            id: string
            name: string
            displayTag: string
            aliases: string[]
            embedding: number[]
            topicIds: string[]
          }
      topics: { topic: Topic; notes: NoteSummary[] }[]
    }[] = []

    // Precompute summaries by topic
    const summariesByTopic: Record<string, NoteSummary[]> = {}
    for (const s of Object.values(props.summaries || {})) {
      ;(summariesByTopic[s.topicId] ||= []).push(s)
    }

    // Precompute topics by category
    const byCategory: Record<string, Topic[]> = {}
    for (const t of Object.values(props.topics || {})) {
      const catId = t.categoryId || 'uncategorized'
      ;(byCategory[catId] ||= []).push(t)
    }

    // Add real categories
    for (const cat of Object.values(props.categories || {})) {
      const childTopics = (byCategory[cat.id] || [])
        .sort((a, b) => {
          const aTag = a.displayTag || a.name
          const bTag = b.displayTag || b.name
          return aTag.localeCompare(bTag)
        })
        .map((topic) => ({
          topic,
          notes: (summariesByTopic[topic.id] || []).sort(
            (a, b) => b.createdAt - a.createdAt
          )
        }))
      out.push({ category: cat, topics: childTopics })
    }

    // Add uncategorized if any
    if (byCategory['uncategorized']) {
      const uncat = {
        id: 'uncategorized',
        name: 'Uncategorized',
        displayTag: 'Uncategorized',
        aliases: [],
        embedding: [],
        topicIds: []
      }
      const childTopics = byCategory['uncategorized']
        .sort((a, b) => {
          const aTag = a.displayTag || a.name
          const bTag = b.displayTag || b.name
          return aTag.localeCompare(bTag)
        })
        .map((topic) => ({
          topic,
          notes: (summariesByTopic[topic.id] || []).sort(
            (a, b) => b.createdAt - a.createdAt
          )
        }))
      out.push({ category: uncat, topics: childTopics })
    }

    // Sort categories (including uncategorized)
    out.sort((a, b) => {
      const aTag = a.category.displayTag || a.category.name
      const bTag = b.category.displayTag || b.category.name
      return aTag.localeCompare(bTag)
    })

    return out
  }, [props.categories, props.topics, props.summaries])

  return (
    <div className='w-80 shrink-0 border-r h-screen flex flex-col'>
      <div className='p-3 border-b flex items-center justify-between'>
        <div className='font-semibold'>Summaries</div>
        <div className='flex items-center gap-2'>
          <button
            onClick={props.onCreateNew}
            className='inline-flex items-center gap-2 rounded-xl border px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800'
          >
            <Plus className='h-4 w-4' /> New
          </button>
          <button
            onClick={props.onClearAll}
            className='inline-flex items-center gap-2 rounded-xl border px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600'
          >
            <Trash className='h-4 w-4' /> Clear All
          </button>
        </div>
      </div>
      <div className='overflow-y-auto'>
        {categoryGroups.map(({ category, topics }) => (
          <div key={category.id} className='border-b'>
            <div className='px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-black flex items-center gap-2'>
              <Tag className='h-4 w-4' />
              <span className='text-purple-600 font-semibold'>
                {category.displayTag || category.name}
              </span>
              {category.displayTag && category.displayTag !== category.name && (
                <span className='text-xs text-gray-400'>({category.name})</span>
              )}
              <span className='ml-auto text-xs text-gray-500'>
                {topics.length} topics
              </span>
            </div>
            {topics.map(({ topic, notes }) => (
              <div key={topic.id} className='pl-4 border-l'>
                <div className='px-3 py-2 text-sm font-medium flex items-center gap-2'>
                  <Tag className='h-4 w-4' />
                  <span className='text-blue-600 font-semibold'>
                    {topic.displayTag || topic.name}
                  </span>
                  {topic.displayTag && topic.displayTag !== topic.name && (
                    <span className='text-xs text-gray-400'>
                      ({topic.name})
                    </span>
                  )}
                  <span className='ml-auto text-xs text-gray-500'>
                    {notes.length}
                  </span>
                </div>
                <ul>
                  {notes.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => props.onSelectNote(n.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          props.selectedNoteId === n.id
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : ''
                        }`}
                      >
                        {trimTitle(n.summary)}
                        <div className='text-xs text-gray-500'>
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
