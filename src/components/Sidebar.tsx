import React, { useMemo } from 'react'
import { Plus, Tag, Trash } from 'lucide-react'
import type { Topic, NoteSummary } from '../types'
import { trimTitle, normalizeTagName } from '../utils/textProcessing'

interface SidebarProps {
  topics: Record<string, Topic>
  summaries: Record<string, NoteSummary>
  onSelectNote: (id: string) => void
  onCreateNew: () => void
  onClearAll: () => void
  selectedNoteId?: string | null
}

export function Sidebar(props: SidebarProps) {
  const groups = useMemo(() => {
    const out: { label: string; topicIds: string[]; notes: NoteSummary[] }[] =
      []
    const map = props.topics
    const sums = props.summaries

    // Group notes by normalized label (displayTag || name)
    const byLabel: Record<
      string,
      { topicIds: string[]; notes: NoteSummary[] }
    > = {}
    for (const s of Object.values(sums)) {
      const topic = map[s.topicId]
      if (!topic) continue // Skip if topic is missing
      const label = normalizeTagName(topic.displayTag || topic.name)
      if (!byLabel[label]) {
        byLabel[label] = { topicIds: [], notes: [] }
      }
      byLabel[label].topicIds.push(s.topicId)
      byLabel[label].notes.push(s)
    }

    // Create sorted groups for display
    for (const [label, { topicIds, notes }] of Object.entries(byLabel)) {
      out.push({
        label,
        topicIds,
        notes: notes.sort((a, b) => b.createdAt - a.createdAt) // Sort notes by creation date
      })
    }

    // Sort groups alphabetically by label
    out.sort((a, b) => a.label.localeCompare(b.label))

    return out
  }, [props.topics, props.summaries])

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
        {groups.map(({ label, topicIds, notes }) => (
          <div key={label} className='border-b'>
            <div className='px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-black flex items-center gap-2'>
              <Tag className='h-4 w-4' />
              <span className='text-blue-600 font-semibold'>{label}</span>
              {topicIds.length > 1 && (
                <span className='text-xs text-gray-400'>
                  (merged {topicIds.length} topics)
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
    </div>
  )
}
