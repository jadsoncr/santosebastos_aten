import type { Metadata } from 'next'
import { Syne, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-syne',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BRO Resolve',
  description: 'Painel operacional — Santos & Bastos Advogados',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  )
}
