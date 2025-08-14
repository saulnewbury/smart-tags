// app/api/transcript/route.ts

import { NextRequest, NextResponse } from 'next/server'

// Enhanced function to extract video ID from various YouTube URL formats including Shorts
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Handle YouTube Shorts URLs
    if (
      urlObj.hostname.includes('youtube.com') &&
      urlObj.pathname.includes('/shorts/')
    ) {
      const match = urlObj.pathname.match(/\/shorts\/([^\/\?]+)/)
      return match ? match[1] : null
    }

    // Handle youtu.be shorts
    if (
      urlObj.hostname.includes('youtu.be') &&
      urlObj.pathname.includes('/shorts/')
    ) {
      const match = urlObj.pathname.match(/\/shorts\/([^\/\?]+)/)
      return match ? match[1] : null
    }

    // Handle regular YouTube URLs
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v')
    } else if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1).split('?')[0] // Remove query params if any
    }
  } catch (e) {
    // Regex fallback for various URL formats
    const patterns = [
      // YouTube Shorts patterns
      /youtube\.com\/shorts\/([^&\n?#\/]+)/,
      /youtu\.be\/shorts\/([^&\n?#\/]+)/,
      // Regular YouTube patterns
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      include_timestamps = false,
      timestamp_format = 'seconds'
    } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    console.log('Processing URL with Python YouTube Transcript API:', url)

    // Extract video ID with enhanced Shorts support
    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            'Invalid YouTube URL format. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID'
        },
        { status: 400 }
      )
    }

    // Detect if it's a Shorts URL to preserve the original format
    const isShorts = url.includes('/shorts/')
    const cleanUrl = isShorts
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`

    // Call Python FastAPI microservice
    const pythonServiceUrl =
      process.env.PYTHON_TRANSCRIPT_SERVICE_URL || 'http://localhost:8001'
    const transcriptUrl = `${pythonServiceUrl}/transcript`

    console.log('Calling Python transcript service at:', transcriptUrl)
    console.log('Video ID:', videoId, 'Is Shorts:', isShorts)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(transcriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive'
        },
        body: JSON.stringify({
          url: cleanUrl,
          include_timestamps,
          timestamp_format,
          include_metadata: true,
          force_fallback: isShorts // Use fallback methods for Shorts
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Python service error:', response.status, errorData)

        if (response.status === 404) {
          const errorMessage = isShorts
            ? 'No transcript found for this YouTube Short. Many Shorts do not have transcripts available.'
            : 'No transcript found for this video.'

          return NextResponse.json(
            {
              error: errorData.detail || errorMessage
            },
            { status: 400 }
          )
        } else if (response.status === 500) {
          return NextResponse.json(
            {
              error:
                errorData.detail ||
                'Transcript service error. Please try again.'
            },
            { status: 500 }
          )
        } else {
          return NextResponse.json(
            {
              error:
                errorData.detail || 'Failed to extract transcript from video.'
            },
            { status: response.status }
          )
        }
      }

      const transcriptData = await response.json()
      console.log('Transcript extraction completed successfully')
      console.log(
        'Is Shorts:',
        transcriptData.is_shorts,
        'Source:',
        transcriptData.transcript_source
      )

      return NextResponse.json({
        text: transcriptData.text,
        segments: transcriptData.segments || null,
        status: 'completed',
        audio_duration: transcriptData.total_duration,
        video_title: transcriptData.video_title || 'YouTube Video',
        service: 'youtube_transcript_api',
        language_code: transcriptData.language_code,
        is_generated: transcriptData.is_generated,
        video_id: transcriptData.video_id,
        total_segments: transcriptData.total_segments,
        total_duration: transcriptData.total_duration,
        include_timestamps: include_timestamps,
        timestamp_format: timestamp_format,
        has_timestamps: include_timestamps && transcriptData.text.includes('['),
        raw_segments: transcriptData.segments
          ? transcriptData.segments.length
          : 0,
        // Additional Shorts-specific info
        is_shorts: transcriptData.is_shorts || false,
        transcript_source: transcriptData.transcript_source || 'direct'
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Error calling Python transcript service:', fetchError)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Transcript service timed out. Please try again.' },
          { status: 504 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to connect to transcript service.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('YouTube transcript API error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the transcript' },
      { status: 500 }
    )
  }
}
