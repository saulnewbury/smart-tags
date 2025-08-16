// utils/storage.ts

import type { Topic, NoteSummary, Category } from '../types'

export const LS_KEYS = {
  topics: 'gist-topics',
  summaries: 'gist-summaries',
  categories: 'gist-categories'
}

// Categories
export function loadCategories(): Record<string, Category> {
  try {
    const json = localStorage.getItem(LS_KEYS.categories)
    return json ? (JSON.parse(json) as Record<string, Category>) : {}
  } catch {
    return {}
  }
}

export function saveCategories(map: Record<string, Category>) {
  localStorage.setItem(LS_KEYS.categories, JSON.stringify(map))
}

// Categories
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

// Summaries
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

// Uid
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`
}

export function clearAllData() {
  localStorage.removeItem(LS_KEYS.topics)
  localStorage.removeItem(LS_KEYS.summaries)
  localStorage.removeItem(LS_KEYS.categories)
}
