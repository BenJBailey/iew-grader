import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IEW Grader',
  description:
    'Highlights IEW dress-ups, sentence openers, decorations and banned words in a student paper.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No web fonts: the system stack keeps the static export self-contained, so it
  // works on a LAN-only Raspberry Pi with no outbound network at all.
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
