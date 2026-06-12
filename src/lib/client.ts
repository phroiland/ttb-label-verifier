import { AppData, VerificationResult } from '@/types'

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function verifyLabelRequest(
  file: File,
  appData: AppData,
): Promise<{ result: VerificationResult; elapsedMs: number }> {
  const started = performance.now()
  const imageBase64 = await fileToBase64(file)
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mediaType: file.type, appData }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Verification failed')
  return { result: data.result, elapsedMs: Math.round(performance.now() - started) }
}
