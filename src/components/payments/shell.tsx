import Image from 'next/image'
import Link from 'next/link'
import { CreditCard, Store, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

export function Brand() {
  return <Link href="/" className="payment-brand"><Image src="/millennium-mark.svg" width={32} height={32} alt="" />Millennium</Link>
}

export function PaymentShell({ children, account }: { children: ReactNode; account?: string }) {
  return <div className="payment-shell">
    <header className="payment-header"><Brand /><span className="payment-badge">Ambiente de teste</span>{account && <span className="payment-account">{account}</span>}</header>
    {account && <nav className="payment-nav" aria-label="Pagamentos">
      <Link href="/dashboard/checkout"><CreditCard size={18} />Checkout</Link>
      <Link href="/dashboard/vendedores"><Store size={18} />Vendedores</Link>
    </nav>}
    {children}
    <footer className="payment-footer"><ShieldCheck size={16} aria-hidden="true" />Millennium <span>Todos os direitos reservados.</span></footer>
  </div>
}
