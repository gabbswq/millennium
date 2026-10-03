import { accountAccess } from '@/lib/stripe/server'
import { StripeAction, RefreshStatus } from '@/components/payments/actions'
import { LockKeyhole, ShieldCheck } from 'lucide-react'

const labels = { pending: 'Cadastro pendente', review: 'Em analise na Stripe', blocked: 'Operacao bloqueada', ready: 'Cadastro habilitado na Stripe' }
export default async function SellersPage() {
  const context = await accountAccess()
  const canStart = context.reason === 'onboarding' || context.reason === 'provider' && context.kyc.state !== 'ready'
  return <>
    <div className="payment-title"><div><p className="payment-eyebrow">Stripe Connect</p><h1>Vendedores</h1></div><RefreshStatus /></div>
    <section className="payment-section"><h2>Cadastro do vendedor</h2>
      <div className="payment-status"><span aria-hidden="true">{context.kyc.state === 'ready' ? <ShieldCheck size={24} /> : <LockKeyhole size={24} />}</span>
        <div><h3>{labels[context.kyc.state]}</h3><p>
          {context.reason === 'configuration' ? 'Integracao de vendedores ainda nao configurada.' :
           context.reason === 'uncertain' ? 'A criacao da conta precisa de conciliacao. Nao inicie outro cadastro.' :
           context.reason === 'database' || context.reason === 'provider-unavailable' ? 'Nao foi possivel verificar o cadastro agora.' :
           context.kyc.state === 'ready' ? 'Verificacao consultada na Stripe. Repasses e comissoes ainda nao estao habilitados neste aplicativo.' :
           context.kyc.state === 'review' ? 'Aguarde a verificacao da Stripe antes de operar.' :
           context.kyc.state === 'blocked' ? 'A Stripe nao habilitou esta conta para operar.' : 'Conclua os dados e a verificacao na Stripe para habilitar a conta.'}
        </p></div>
      </div>
      {context.kyc.pendingCount > 0 && <p className="payment-notice">{context.kyc.pendingCount} requisito(s) pendente(s) na Stripe.</p>}
      <StripeAction seller enabled={canStart} />
    </section>
  </>
}
