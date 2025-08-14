// hooks/useStore.ts

import { useEffect, useState } from 'react'
import type { Topic, NoteSummary } from '../types'
import {
  loadTopics,
  saveTopics,
  loadSummaries,
  saveSummaries
} from '../utils/storage'

export function useStore() {
  const [topics, setTopics] = useState<Record<string, Topic>>({})
  const [summaries, setSummaries] = useState<Record<string, NoteSummary>>({})

  useEffect(() => {
    setTopics(loadTopics())
    setSummaries(loadSummaries())
  }, [])

  useEffect(() => saveTopics(topics), [topics])
  useEffect(() => saveSummaries(summaries), [summaries])

  return {
    topics,
    setTopics,
    summaries,
    setSummaries
  }
}
