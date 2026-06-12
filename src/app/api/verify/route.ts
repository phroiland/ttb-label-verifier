import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildVerificationPrompt } from '@/lib/prompt'
import { checkGovernmentWarning } from '@/lib/warning-check'
import { AppData, VerificationResult, FieldCheck, OverallStatus } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Lightweight in-memory, per-IP sliding window. Note: serverless instances each
// hold their own map, so this is best-effort protection for a prototype — a
// production deployment would use a durable store (e.g. Redis/Upstash).
const RATE_LIMIT = 30 // max requests…
const WINDOW_MS = 10 * 60 * 1000 // …per 10 minutes per IP
const hits = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

const MAX_IMAGE_BASE64_CHARS = 10_000_000 // ~7.5 MB binary

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests — please wait a few minutes and try again.' },
        { status: 429 },
      )
    }

    const body = await req.json()
    const { imageBase64, mediaType, appData } = body as {
      imageBase64: string
      mediaType: string
      appData: AppData
    }

    if (!imageBase64 || !mediaType || !appData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json(
        { error: 'Image too large — please use an image under ~7 MB.' },
        { status: 413 },
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
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
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string }) => (b as { type: 'text'; text: string }).text)
      .join('')

    const clean = raw.replace(/```json|```/g, '').trim()
    const result: VerificationResult = JSON.parse(clean)

    // ── Fill application values server-side ─────────────────────────────────
    // The model no longer echoes application data back (saves output tokens →
    // faster responses); we already have it and attach it here.
    const fieldToValue = (field: string): string => {
      const f = field.toLowerCase()
      if (f.includes('warning')) return 'Statutory warning text (27 CFR Part 16)'
      if (f.includes('brand')) return appData.brand
      if (f.includes('class') || f.includes('type')) return appData.classType
      if (f.includes('alcohol') || f.includes('abv')) return appData.abv
      if (f.includes('net')) return appData.net
      if (f.includes('producer') || f.includes('bottler')) return appData.producer
      if (f.includes('origin') || f.includes('country')) return appData.origin
      return ''
    }
    result.checks.forEach((c) => {
      c.applicationValue = c.applicationValue || fieldToValue(c.field) || '(not provided)'
    })

    // ── Deterministic government warning check ──────────────────────────────
    // The model only TRANSCRIBES the warning; exactness is judged here in code.
    // Skipped if the image was unreadable.
    if (result.overallStatus === 'unreadable') {
      // Normalize: an unreadable image yields no verdict on any field
      result.checks.forEach((c) => {
        c.status = 'missing'
        c.labelValue = null
        if (!c.note) c.note = 'Image quality insufficient to extract this field'
      })
    } else {
      const warningCheck = result.checks.find((c) =>
        c.field.toLowerCase().includes('warning'),
      )
      if (warningCheck) {
        const verdict = checkGovernmentWarning(warningCheck.labelValue)
        warningCheck.status = verdict.status
        warningCheck.note = verdict.note
        warningCheck.applicationValue = 'Statutory warning text (27 CFR Part 16)'
        result.warningDiff = verdict.diff

        // Recompute overall status now that the warning verdict may have changed
        result.overallStatus = computeOverall(result.checks)
        if (verdict.status === 'fail' || verdict.status === 'missing') {
          result.overallSummary = appendSummary(result.overallSummary, 'Government warning check failed (deterministic word-for-word comparison).')
        }
      }
    }

    result.processingMs = Date.now() - started
    return NextResponse.json({ result })
  } catch (err) {
    console.error('Verify error:', err)
    const raw = err instanceof Error ? err.message : ''
    const message = raw.includes('authentication')
      ? 'Verification service is not configured correctly (API key). Contact your administrator.'
      : raw.includes('rate_limit')
      ? 'Too many requests at once — wait a moment and retry this label.'
      : raw.includes('overloaded')
      ? 'Verification service is temporarily busy — retry in a few seconds.'
      : 'Verification failed — please retry. If this persists, contact your administrator.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function computeOverall(checks: FieldCheck[]): OverallStatus {
  if (checks.some((c) => c.status === 'fail' || c.status === 'missing')) return 'fail'
  if (checks.some((c) => c.status === 'warn')) return 'warn'
  return 'pass'
}

function appendSummary(existing: string, addition: string): string {
  const base = (existing || '').trim().replace(/\.?$/, '.')
  return base === '.' ? addition : `${base} ${addition}`
}
