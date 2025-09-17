// app/api/transcript/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { parseYouTubeUrl } from '@/utils/youtube' // Import the centralized utility

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      include_timestamps = true,
      timestamp_format = 'minutes',
      grouping_strategy = 'smart',
      min_interval = 10
    } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    console.log('Processing URL with Python YouTube Transcript API:', url)

    // Use centralized YouTube URL parser
    const youtubeInfo = parseYouTubeUrl(url)

    if (!youtubeInfo) {
      return NextResponse.json(
        {
          error:
            'Invalid YouTube URL format. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID'
        },
        { status: 400 }
      )
    }

    const { videoId, isShorts, cleanUrl } = youtubeInfo

    console.log('Parsed YouTube info:', { videoId, isShorts, cleanUrl })

    // Call Python FastAPI microservice
    const pythonServiceUrl =
      process.env.PYTHON_TRANSCRIPT_SERVICE_URL || 'http://localhost:8001'
    const transcriptUrl = `${pythonServiceUrl}/transcript`

    console.log('Calling Python transcript service at:', transcriptUrl)

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
          grouping_strategy,
          min_interval,
          include_metadata: true,
          force_fallback: isShorts
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

      // Always include the video ID from our parsing (most reliable)
      return NextResponse.json({
        text: transcriptData.text,
        segments: transcriptData.segments || null,
        status: 'completed',
        audio_duration: transcriptData.total_duration,
        video_title: transcriptData.video_title || 'YouTube Video',
        service: 'youtube_transcript_api',
        language_code: transcriptData.language_code,
        is_generated: transcriptData.is_generated,
        video_id: videoId, // Use our parsed video ID as the source of truth
        original_url: url, // Keep original URL for reference
        clean_url: cleanUrl, // Normalized URL
        is_shorts: isShorts, // From our parsing
        total_segments: transcriptData.total_segments,
        total_duration: transcriptData.total_duration,
        include_timestamps: include_timestamps,
        timestamp_format: timestamp_format,
        has_timestamps: include_timestamps && transcriptData.text.includes('['),
        raw_segments: transcriptData.segments
          ? transcriptData.segments.length
          : 0,
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
