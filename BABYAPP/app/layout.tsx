import type { Metadata } from 'next'
import { Inter, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TinySteps AI',
  description: 'Emocionálně inteligentní AI copilot pro rodiče dětí 0–3 let.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" className={`${inter.variable} ${dmSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
