import { createClient } from '@/lib/supabase/server'
import { stripeConfiguration } from '@/lib/stripe/server'
import { StripeAction, RefreshStatus } from '@/components/payments/actions'

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const states: Record<string, string> = { pending: 'Aguardando pagamento', paid: 'Pagamento confirmado', failed: 'Pagamento falhou', expired: 'Expirado' }
export default async function CheckoutPage() {
  let configured = false
  try { stripeConfiguration('checkout'); configured = true } catch { /* Disabled until test configuration exists. */ }
  const db = await createClient()
  const { data: prices, error: pricesError } = await db.from('prices').select('id,product_id,amount_cents,currency,interval').eq('active', true).eq('currency', 'brl').is('interval', null).limit(25)
  const { data: products } = await db.from('products').select('id,title').eq('active', true).limit(25)
  const { data: orders, error: ordersError } = await db.from('stripe_checkout_requests')
    .select('id,price_id,amount_cents,currency,creation_state,payment_state,created_at').order('created_at', { ascending: false }).limit(25)
  return <>
    <div className="payment-title"><div><p className="payment-eyebrow">Pagamentos</p><h1>Checkout</h1></div><RefreshStatus /></div>
    {!configured && <p className="payment-notice" role="status">Checkout de teste ainda nao configurado. Nenhuma cobranca sera criada.</p>}
    <section className="payment-section" aria-labelledby="catalog-title"><h2 id="catalog-title">Produtos</h2>
      {pricesError ? <p className="payment-error">Catalogo indisponivel.</p> : <div className="payment-list">
        {prices?.filter(price => products?.some(product => product.id === price.product_id)).map(price =>
          <div className="payment-product" key={price.id}><div><h3>{products?.find(product => product.id === price.product_id)?.title}</h3><p>{money(price.amount_cents)}</p></div>
            <StripeAction priceId={price.id}
              fresh={!orders?.some(order => order.price_id === price.id && order.payment_state === 'pending') && Boolean(orders?.some(order => order.price_id === price.id))}
              enabled={configured && !ordersError && !orders?.some(order => order.price_id === price.id && order.payment_state === 'pending' && order.creation_state !== 'BOUND')} />
          </div>)}
        {!prices?.length && <p className="payment-empty">Nenhum produto de pagamento unico disponivel.</p>}
      </div>}
    </section>
    <section className="payment-section" aria-labelledby="orders-title"><h2 id="orders-title">Meus pedidos</h2>
      {ordersError ? <p className="payment-error">Pedidos indisponiveis. Confira a migration de pagamentos.</p> : !orders?.length ? <p className="payment-empty">Nenhum pedido registrado.</p> :
        <div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Pedido</th><th>Valor</th><th>Status</th></tr></thead><tbody>
          {orders.map(order => <tr key={order.id}><td><span title={order.id}>{order.id.slice(0, 8)}</span><small>{new Date(order.created_at).toLocaleDateString('pt-BR')}</small></td>
            <td>{money(order.amount_cents)}</td><td><span className={order.payment_state === 'paid' ? 'payment-state-ready' : ''}>
              {order.creation_state === 'UNCERTAIN' || order.creation_state === 'CREATING' ? 'Aguardando conciliacao' : states[order.payment_state]}
            </span></td></tr>)}
        </tbody></table></div>}
    </section>
  </>
}
