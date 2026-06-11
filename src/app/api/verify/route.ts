import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildVerificationPrompt } from '@/lib/prompt'
import { AppData, VerificationResult } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64, mediaType, appData } = body as {
      imageBase64: string
      mediaType: string
      appData: AppData
    }

    if (!imageBase64 || !mediaType || !appData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: buildVerificationPrompt(appData),
            },
          ],
        },
      ],
    })

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    const clean = raw.replace(/```json|```/g, '').trim()
    const result: VerificationResult = JSON.parse(clean)

    return NextResponse.json({ result })
  } catch (err) {
    console.error('Verify error:', err)
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
