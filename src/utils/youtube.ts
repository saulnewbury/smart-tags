// utils/youtube.ts

interface YouTubeInfo {
  videoId: string
  isShorts: boolean
  cleanUrl: string
  embedUrl: string
  timestampUrl: (seconds: number) => string
}

/**
 * Centralized YouTube URL parser that handles all formats
 * including regular videos and Shorts
 */
export function parseYouTubeUrl(url: string): YouTubeInfo | null {
  // Remove any whitespace and decode URL entities
  const cleanInput = decodeURIComponent(url.trim())

  // Comprehensive regex patterns for all YouTube URL formats
  const patterns = [
    // YouTube Shorts patterns (check these first)
    { regex: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, isShorts: true },
    { regex: /youtu\.be\/shorts\/([a-zA-Z0-9_-]{11})/, isShorts: true },

    // Standard YouTube patterns
    { regex: /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, isShorts: false },
    { regex: /youtu\.be\/([a-zA-Z0-9_-]{11})/, isShorts: false },
    { regex: /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, isShorts: false },
    { regex: /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, isShorts: false },
    { regex: /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/, isShorts: false },

    // YouTube Music
    {
      regex: /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      isShorts: false
    }
  ]

  for (const { regex, isShorts } of patterns) {
    const match = cleanInput.match(regex)
    if (match && match[1]) {
      const videoId = match[1]

      return {
        videoId,
        isShorts,
        cleanUrl: isShorts
          ? `https://www.youtube.com/shorts/${videoId}`
          : `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        timestampUrl: (seconds: number) =>
          `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`
      }
    }
  }

  // Try URL parsing as fallback
  try {
    const urlObj = new URL(cleanInput)

    // Check query parameter
    const vParam = urlObj.searchParams.get('v')
    if (vParam && vParam.match(/^[a-zA-Z0-9_-]{11}$/)) {
      return {
        videoId: vParam,
        isShorts: false,
        cleanUrl: `https://www.youtube.com/watch?v=${vParam}`,
        embedUrl: `https://www.youtube.com/embed/${vParam}`,
        timestampUrl: (seconds: number) =>
          `https://www.youtube.com/watch?v=${vParam}&t=${Math.floor(seconds)}s`
      }
    }
  } catch {
    // Invalid URL, continue to return null
  }

  return null
}

/**
 * Parse timestamp string to seconds
 * Handles formats: [1:23], [45.2s], [1:23:45], [45], etc.
 */
export function parseTimestampToSeconds(timestamp: string): number {
  // Remove brackets and 's' suffix if present
  const clean = timestamp.replace(/[\[\]]/g, '').replace(/s$/, '')

  if (clean.includes(':')) {
    const parts = clean.split(':').map(Number)
    if (parts.length === 2) {
      // mm:ss format
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      // hh:mm:ss format
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
  } else {
    // Direct seconds format
    return parseFloat(clean) || 0
  }

  return 0
}

/**
 * Format seconds to display timestamp
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Validate if a string is a valid YouTube video ID
 */
export function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id)
}

/**
 * Extract all video IDs from text that might contain multiple YouTube URLs
 */
export function extractAllVideoIds(text: string): string[] {
  const ids = new Set<string>()
  const lines = text.split(/\s+/)

  for (const line of lines) {
    const info = parseYouTubeUrl(line)
    if (info) {
      ids.add(info.videoId)
    }
  }

  return Array.from(ids)
}
