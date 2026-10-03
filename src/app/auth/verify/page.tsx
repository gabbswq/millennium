import { redirect } from 'next/navigation'
import { authenticatedUser } from '@/lib/stripe/server'
import { verifiedIdentity } from '@/lib/stripe/kyc'
import { PaymentShell } from '@/components/payments/shell'
import { SignOutButton } from '@/app/dashboard/sign-out-button'

export default async function VerifyPage() {
  let context
  try { context = await authenticatedUser() } catch { redirect('/auth/login') }
  if (verifiedIdentity(context.user)) redirect('/dashboard')
  return <PaymentShell><main className="payment-access"><h1>Confirme seu email</h1>
    <p>O acesso aos pagamentos fica bloqueado ate a confirmacao da conta.</p><p>{context.user.email}</p><SignOutButton />
  </main></PaymentShell>
}
