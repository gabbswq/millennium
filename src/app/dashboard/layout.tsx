import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { authenticatedUser, authConfigured } from '@/lib/stripe/server'
import { verifiedIdentity } from '@/lib/stripe/kyc'
import { PaymentShell } from '@/components/payments/shell'
import { SignOutButton } from './sign-out-button'

export const dynamic = 'force-dynamic'
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!authConfigured()) redirect('/auth/login')
  let context
  try { context = await authenticatedUser() } catch { redirect('/auth/login') }
  if (!verifiedIdentity(context.user)) redirect('/auth/verify')
  return <PaymentShell account={context.user.email ?? 'Minha conta'}>
    <main className="payment-content">{children}<div className="payment-signout"><SignOutButton /></div></main>
  </PaymentShell>
}
