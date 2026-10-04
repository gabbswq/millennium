import { trustedStripeUrl } from './kyc'

export interface Connection {
  user_id: string
  request_id: string
  stripe_account_id: string | null
  creation_state: 'RESERVED' | 'CREATING' | 'UNCERTAIN' | 'BOUND'
  livemode: boolean
}
export interface ConnectionStore {
  reserve(): Promise<Connection>
  claim(): Promise<Connection | null>
  bind(connection: Connection, accountId: string): Promise<void>
  uncertain(connection: Connection): Promise<void>
}
export interface OnboardingProvider {
  create(requestId: string): Promise<{ id: string; metadata?: Record<string, string> }>
  link(accountId: string): Promise<string>
}
export class OnboardingError extends Error {
  constructor(public status: number, message: string, public retryAfterSeconds?: number) { super(message) }
}

export async function beginOnboarding(store: ConnectionStore, provider: OnboardingProvider): Promise<string> {
  let connection = await store.reserve()
  if (connection.livemode !== false) throw new OnboardingError(403, 'Esta versao aceita somente contas de teste.')
  if (connection.creation_state !== 'BOUND') {
    if (connection.creation_state !== 'RESERVED') throw new OnboardingError(409, 'Cadastro em andamento ou com resultado incerto. Nenhuma nova conta foi criada.')
    const claimed = await store.claim()
    if (!claimed || claimed.creation_state !== 'CREATING' || claimed.request_id !== connection.request_id || claimed.user_id !== connection.user_id || claimed.livemode !== false) {
      throw new OnboardingError(409, 'Outra solicitacao ja iniciou este cadastro.')
    }
    connection = claimed
    try {
      const account = await provider.create(connection.request_id)
      if (!/^acct_[A-Za-z0-9]+$/.test(account.id) || account.metadata?.millennium_request_id !== connection.request_id) {
        throw new Error('Provider connection mismatch')
      }
      await store.bind(connection, account.id)
      connection = { ...connection, stripe_account_id: account.id, creation_state: 'BOUND' }
    } catch {
      await store.uncertain(connection).catch(() => {})
      throw new OnboardingError(503, 'Cadastro sem resultado confirmado. Nao repetir a criacao.')
    }
  }
  if (!connection.stripe_account_id || !/^acct_[A-Za-z0-9]+$/.test(connection.stripe_account_id)) {
    throw new OnboardingError(503, 'Vinculo Stripe indisponivel.')
  }
  let url: string
  try { url = await provider.link(connection.stripe_account_id) }
  catch { throw new OnboardingError(503, 'Nao foi possivel abrir o cadastro Stripe. Tente novamente mais tarde.') }
  if (!trustedStripeUrl(url)) throw new OnboardingError(502, 'Endereco Stripe invalido.')
  return url
}
