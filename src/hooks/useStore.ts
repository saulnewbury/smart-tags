// hooks/useStore.ts

import { useEffect, useState } from 'react'
import type { Topic, NoteSummary, SuperCategory } from '../types'
import {
  loadTopics,
  saveTopics,
  loadSummaries,
  saveSummaries
} from '../utils/storage'
import {
  loadSuperCategories,
  saveSuperCategories
} from '../utils/superCategoryStorage'

export function useStore() {
  const [topics, setTopics] = useState<Record<string, Topic>>({})
  const [summaries, setSummaries] = useState<Record<string, NoteSummary>>({})
  const [superCategories, setSuperCategories] = useState<
    Record<string, SuperCategory>
  >({})

  useEffect(() => {
    setTopics(loadTopics())
    setSummaries(loadSummaries())
    setSuperCategories(loadSuperCategories())
  }, [])

  useEffect(() => saveTopics(topics), [topics])
  useEffect(() => saveSummaries(summaries), [summaries])
  useEffect(() => saveSuperCategories(superCategories), [superCategories])

  return {
    topics,
    setTopics,
    summaries,
    setSummaries,
    superCategories,
    setSuperCategories
  }
}
