// utils/storage.ts

import type { Topic, NoteSummary } from '../types'

export const LS_KEYS = {
  topics: 'gist-topics',
  summaries: 'gist-summaries'
}

export function loadTopics(): Record<string, Topic> {
  try {
    const json = localStorage.getItem(LS_KEYS.topics)
    return json ? (JSON.parse(json) as Record<string, Topic>) : {}
  } catch {
    return {}
  }
}

export function saveTopics(map: Record<string, Topic>) {
  localStorage.setItem(LS_KEYS.topics, JSON.stringify(map))
}

export function loadSummaries(): Record<string, NoteSummary> {
  try {
    const json = localStorage.getItem(LS_KEYS.summaries)
    return json ? (JSON.parse(json) as Record<string, NoteSummary>) : {}
  } catch {
    return {}
  }
}

export function saveSummaries(map: Record<string, NoteSummary>) {
  localStorage.setItem(LS_KEYS.summaries, JSON.stringify(map))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`
}

export function clearAllData() {
  localStorage.removeItem(LS_KEYS.topics)
  localStorage.removeItem(LS_KEYS.summaries)
}
