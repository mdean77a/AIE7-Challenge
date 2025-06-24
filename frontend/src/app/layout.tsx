import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Streaming Chat Interface',
  description: 'A modern chat interface showcasing real-time AI streaming responses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 