// components/ClickableTranscript.tsx

import React from 'react'
import { ExternalLink } from 'lucide-react'

interface ClickableTranscriptProps {
  text: string
  videoId?: string
  className?: string
}

export function ClickableTranscript({
  text,
  videoId,
  className = ''
}: ClickableTranscriptProps) {
  console.log('ClickableTranscript received:', {
    videoId,
    textLength: text.length
  })

  const parseTimestamps = (text: string) => {
    // Regex to match timestamp patterns: [1:23], [45.2s], [1:23:45], etc.
    const timestampRegex = /\[(\d+(?::\d+)?(?::\d+)?(?:\.\d+)?s?)\]/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = timestampRegex.exec(text)) !== null) {
      // Add text before timestamp
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        })
      }

      // Parse the timestamp to seconds
      const timestampText = match[1]
      const seconds = parseTimestampToSeconds(timestampText)

      parts.push({
        type: 'timestamp',
        content: match[0], // Full match including brackets
        timestampText,
        seconds,
        url: videoId
          ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
              seconds
            )}s`
          : null
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      })
    }

    return parts
  }

  const parseTimestampToSeconds = (timestamp: string): number => {
    // Remove 's' suffix if present
    const cleanTimestamp = timestamp.replace(/s$/, '')

    if (cleanTimestamp.includes(':')) {
      const parts = cleanTimestamp.split(':').map(Number)
      if (parts.length === 2) {
        // mm:ss format
        return parts[0] * 60 + parts[1]
      } else if (parts.length === 3) {
        // hh:mm:ss format
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
      }
    } else {
      // Seconds format (45.2 or 45)
      return parseFloat(cleanTimestamp)
    }

    return 0
  }

  const formatTimeForDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const parts = parseTimestamps(text)
  console.log('Parsed parts:', parts.slice(0, 3)) // Log first 3 parts for debugging

  return (
    <div className={`whitespace-pre-wrap text-sm leading-6 ${className}`}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>
        } else {
          // Timestamp part
          if (part.url && videoId) {
            return (
              <a
                key={index}
                href={part.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors duration-200 mx-1'
                title={`Jump to ${formatTimeForDisplay(
                  part.seconds
                )} in YouTube video`}
              >
                <span className='text-xs'>
                  [{formatTimeForDisplay(part.seconds)}]
                </span>
                <ExternalLink className='h-3 w-3 opacity-60' />
              </a>
            )
          } else {
            return (
              <span key={index} className='text-gray-500 font-medium mx-1'>
                {part.content}
              </span>
            )
          }
        }
      })}
    </div>
  )
}
