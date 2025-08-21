// services/transcript.ts

export async function fetchTranscript(url: string): Promise<{
  text: string
  segments?: any[]
  videoTitle?: string
  videoId?: string // Add this
}> {
  const apiResponse = await fetch('/api/transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: url,
      include_timestamps: true, // Always true now
      timestamp_format: 'minutes', // Always minutes format
      grouping_strategy: 'smart', // Use smart grouping
      min_interval: 10 // 10 second minimum intervals
    })
  })

  if (!apiResponse.ok) {
    const errorData = await apiResponse.json()
    throw new Error(errorData.error || 'Failed to fetch transcript')
  }

  const transcriptData = await apiResponse.json()
  const transcript = transcriptData.text

  if (!transcript) {
    throw new Error('No transcript available for this video')
  }

  console.log('Transcript API response:', transcriptData) // Debug log

  return {
    text: transcript,
    segments: transcriptData.segments,
    videoTitle: transcriptData.video_title,
    videoId: transcriptData.video_id // Add this line
  }
}
