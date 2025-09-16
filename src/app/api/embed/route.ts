// app/api/embed/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { pipeline, env } from '@xenova/transformers'

// Configure cache directory for model files
env.cacheDir = './.cache/transformers'
env.localURL = '/models/' // Optional: serve models from your public directory

// Global model instance - persists across requests in production
let embedder: any = null

async function getEmbedder() {
  if (!embedder) {
    console.log('[Embed API] Loading model (one-time operation)...')
    const startTime = Date.now()

    // Using all-MiniLM-L6-v2: Good balance of speed and quality
    // Alternatives:
    // - 'Xenova/all-mpnet-base-v2' (better quality, slower)
    // - 'Xenova/gte-small' (good for multilingual)
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true // Use quantized model for smaller size & faster inference
    })

    console.log(`[Embed API] Model loaded in ${Date.now() - startTime}ms`)
  }
  return embedder
}

export async function POST(request: NextRequest) {
  try {
    const { text, texts } = await request.json()

    if (!text && !texts) {
      return NextResponse.json(
        { error: 'Either "text" or "texts" array is required' },
        { status: 400 }
      )
    }

    const model = await getEmbedder()

    // Handle single text
    if (text) {
      console.log(
        `[Embed API] Generating embedding for text (${text.length} chars)`
      )

      const result = await model(text, {
        pooling: 'mean', // Average pooling
        normalize: true // Normalize to unit vector (for cosine similarity)
      })

      return NextResponse.json({
        embedding: Array.from(result.data),
        dimensions: result.data.length,
        model: 'all-MiniLM-L6-v2'
      })
    }

    // Handle batch texts
    if (texts) {
      console.log(`[Embed API] Generating embeddings for ${texts.length} texts`)

      const embeddings = await Promise.all(
        texts.map(async (t: string) => {
          const result = await model(t, {
            pooling: 'mean',
            normalize: true
          })
          return Array.from(result.data)
        })
      )

      return NextResponse.json({
        embeddings,
        dimensions: embeddings[0]?.length || 0,
        model: 'all-MiniLM-L6-v2'
      })
    }
  } catch (error) {
    console.error('[Embed API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    )
  }
}

// Optional: Preload model on server start in production
if (process.env.NODE_ENV === 'production') {
  getEmbedder().catch(console.error)
}
