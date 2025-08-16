// hooks/useStore.ts

import { useEffect, useState } from 'react'
import type { Topic, NoteSummary, Category } from '../types'
import {
  loadCategories,
  saveCategories,
  loadTopics,
  saveTopics,
  loadSummaries,
  saveSummaries
} from '../utils/storage'

export function useStore() {
  const [categories, setCategories] = useState<Record<string, Category>>({})
  const [topics, setTopics] = useState<Record<string, Topic>>({})
  const [summaries, setSummaries] = useState<Record<string, NoteSummary>>({})

  useEffect(() => {
    setCategories(loadCategories())
    setTopics(loadTopics())
    setSummaries(loadSummaries())
  }, [])

  useEffect(() => saveCategories(categories), [categories])
  useEffect(() => saveTopics(topics), [topics])
  useEffect(() => saveSummaries(summaries), [summaries])

  return {
    categories,
    setCategories,
    topics,
    setTopics,
    summaries,
    setSummaries
  }
}
