// utils/streaming.ts

export interface StreamCallbacks {
  onToken?: (token: string) => void
  onPartialJSON?: (partial: any) => void
  onComplete?: (data: any) => void
  onError?: (error: Error) => void
}

export async function streamSummaryFromAPI(
  transcript: string,
  userPrompt: string,
  callbacks: StreamCallbacks
): Promise<any> {
  console.log('[Streaming] Starting stream request...')

  try {
    const response = await fetch('/api/stream-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcript, userPrompt })
    })

    console.log(
      '[Streaming] Response received:',
      response.ok,
      response.headers.get('content-type')
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedJSON = ''

    // Track which field we're currently building
    let currentField = ''
    let summaryText = ''
    let isInSummaryField = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // Decode and add to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim() === '') continue
        if (!line.startsWith('data: ')) continue

        const data = line.slice(6)
        if (data === '[DONE]') {
          // Streaming complete, parse the full JSON
          try {
            const completeData = JSON.parse(accumulatedJSON)
            callbacks.onComplete?.(completeData)
            return completeData
          } catch (e) {
            console.error('Failed to parse complete JSON:', e)
            callbacks.onError?.(new Error('Invalid JSON response'))
            throw e
          }
        }

        try {
          const parsed = JSON.parse(data)
          const token = parsed.token

          if (token) {
            accumulatedJSON += token
            callbacks.onToken?.(token)

            // Track if we're in the summary field for better streaming display
            // Simple state machine to track JSON structure
            if (token === '"summary"') {
              currentField = 'summary'
              isInSummaryField = false
            } else if (currentField === 'summary' && token === ':') {
              // Next tokens will be the summary value
              isInSummaryField = false
            } else if (
              currentField === 'summary' &&
              token === ' "' &&
              !isInSummaryField
            ) {
              // Starting the summary value
              isInSummaryField = true
              summaryText = ''
            } else if (isInSummaryField) {
              // Check if this token ends the summary
              if (token === '",' || token === '",') {
                isInSummaryField = false
                currentField = ''
              } else if (token !== '"' && token !== ' "') {
                // Add to summary text (unless it's the opening quote)
                summaryText += token

                // Send partial update with accumulated summary
                callbacks.onPartialJSON?.({
                  summary: summaryText
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"'),
                  isPartial: true,
                  rawJSON: accumulatedJSON
                })
              }
            }

            // Reset field tracking if we see a new field starting
            if (
              token === '"canonical_name"' ||
              token === '"keywords"' ||
              token === '"subjects"'
            ) {
              currentField = token.replace(/"/g, '')
              isInSummaryField = false
            }
          }
        } catch (e) {
          // Ignore parse errors for individual tokens
        }
      }
    }

    // If we got here without [DONE], try to parse what we have
    if (accumulatedJSON) {
      try {
        const result = JSON.parse(accumulatedJSON)
        callbacks.onComplete?.(result)
        return result
      } catch (e) {
        console.error('Failed to parse accumulated JSON:', e)
        throw new Error('Incomplete response from API')
      }
    }

    throw new Error('No data received from API')
  } catch (error) {
    callbacks.onError?.(error as Error)
    throw error
  }
}
