// utils/superCategoryStorage.ts

import type { SuperCategory } from '../types/superCategory'

export const SUPER_CATEGORY_LS_KEY = 'gist-super-categories'

export function loadSuperCategories(): Record<string, SuperCategory> {
  try {
    const json = localStorage.getItem(SUPER_CATEGORY_LS_KEY)
    return json ? (JSON.parse(json) as Record<string, SuperCategory>) : {}
  } catch {
    return {}
  }
}

export function saveSuperCategories(map: Record<string, SuperCategory>) {
  localStorage.setItem(SUPER_CATEGORY_LS_KEY, JSON.stringify(map))
}

export function clearSuperCategories() {
  localStorage.removeItem(SUPER_CATEGORY_LS_KEY)
}
