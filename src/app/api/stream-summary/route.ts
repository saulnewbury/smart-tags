// app/api/stream-summary/route.ts

import { NextRequest } from 'next/server'

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
const SUMMARIZE_MODEL = 'gpt-4o-mini'

export async function POST(request: NextRequest) {
  try {
    const { transcript, userPrompt } = await request.json()

    if (!transcript) {
      return new Response('Transcript is required', { status: 400 })
    }

    // Use your existing prompt that generates all fields at once
    const system = `You are a precise note summarizer for a tagging app. 
Return STRICT JSON with keys: summary, canonical_name, keywords (array), subjects (array). 
- summary: 4-6 tight sentences (or 6-10 bullets if source is long).
- canonical_name: the single best subject label for this note (neutral, general), no hashtags.
- keywords: 5-12 short items (entities, noun phrases, actions).
- subjects: Select the SINGLE most fitting primary super-category from this predefined list (based on the transcript content and canonical_name), and optionally up to TWO additional secondary categories if they strongly apply (no duplicates). The list is: 
  "World & Politics: Geopolitics, current affairs, government, diplomacy, law, human rights",
  "Society & Culture: Identity, norms, religion, lifestyle, media, social movements",
  "Science & Environment: Natural sciences, sustainability, climate, biology, earth systems",
  "Technology & Innovation: AI, software, hardware, digital systems, design, startups",
  "Economy & Work: Business, finance, markets, labor, economic theory",
  "History & Philosophy: Historical events, timelines, legacy systems, big ideas, ethics",
  "Health & Wellbeing: Physical/mental health, medicine, psychology, fitness",
  "Education & Learning: Schools, pedagogy, study techniques, lifelong learning, research methods".
Output an array of 1-3 strings: the primary category name FIRST (e.g., "World & Politics"), followed by secondaries if any (e.g., ["Science & Environment", "World & Politics", "Economy & Work"]). If no perfect fit, choose the closest for primary and skip secondaries if they don't strongly apply.`

    const user = `TRANSCRIPT:\n${transcript}\n\nEXTRA INSTRUCTIONS FROM USER (optional): ${
      userPrompt || '(none)'
    }`

    // Call OpenAI with streaming enabled
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: SUMMARIZE_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      return new Response(`OpenAI API error: ${error}`, {
        status: response.status
      })
    }

    // Create a transform stream to process OpenAI's SSE format
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              break
            }

            // Decode and add to buffer
            buffer += decoder.decode(value, { stream: true })

            // Process complete lines
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue
              if (line === 'data: [DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                continue
              }
              if (!line.startsWith('data: ')) continue

              try {
                const data = JSON.parse(line.slice(6))
                const token = data.choices?.[0]?.delta?.content || ''

                if (token) {
                  // Send token to client
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                  )
                }
              } catch (e) {
                console.error('Parse error:', e)
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Stream summary error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
