import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TTB Label Verifier',
  description: 'AI-powered alcohol label compliance verification',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
