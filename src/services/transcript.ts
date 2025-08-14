// services/transcript.ts

export async function fetchTranscript(url: string): Promise<string> {
  const apiResponse = await fetch('/api/transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: url,
      include_timestamps: false,
      timestamp_format: 'seconds'
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

  return transcript
}
