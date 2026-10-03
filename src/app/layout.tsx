import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Millennium',
    template: '%s | Millennium',
  },
  description: 'Millennium. Pagamentos e operacao.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
