// services/transcript.ts

interface FetchTranscriptOptions {
  includeTimestamps?: boolean
  timestampFormat?: string
}

export async function fetchTranscript(
  url: string,
  options: FetchTranscriptOptions = {}
): Promise<{
  text: string
  hasTimestamps: boolean
  timestampFormat?: string
  segments?: any[]
}> {
  const { includeTimestamps = false, timestampFormat = 'minutes' } = options

  const apiResponse = await fetch('/api/transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: url,
      include_timestamps: includeTimestamps,
      timestamp_format: timestampFormat
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

  return {
    text: transcript,
    hasTimestamps: includeTimestamps,
    timestampFormat: timestampFormat,
    segments: transcriptData.segments
  }
}
