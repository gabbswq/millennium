# Millennium: Checkout e Vendedores em homologacao

Codigo de teste, nao gateway financeiro pronto. Nenhuma conta externa foi
configurada por esta feature. Configure por canais seguros do provedor; nao
cole chaves, senhas ou tokens no chat. Nao editar .env neste fluxo do agente.

## Rodar o app

Use uma copia de develop, nunca sobrescreva o checkout pessoal sujo de main:

```sh
npm ci --ignore-scripts
npm run dev -- --hostname 127.0.0.1 --port 4313
```

Abrir http://127.0.0.1:4313. Sem Supabase configurado, o login permanece
indisponivel. Os testes de navegador usam provedor ficticio exclusivamente em
tests/payments/e2e-server.mjs, nao um modo de demonstracao dentro do aplicativo.

## Ambiente do servidor escolhido

| Variavel | Finalidade |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL publica do projeto de homologacao |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Chave publica, com RLS; nunca service key |
| SUPABASE_SERVICE_ROLE_KEY | Exclusiva do servidor, escopo privilegiado |
| MILLENNIUM_APP_ORIGIN | Origem HTTPS exata, sem caminho/query/credenciais |
| STRIPE_SECRET_KEY | Exclusivamente sk_test_ nesta versao |
| STRIPE_CHECKOUT_ENABLED | true somente apos setup do Checkout testado |
| STRIPE_CHECKOUT_WEBHOOK_SECRET | Segredo do endpoint de Checkout |
| STRIPE_CONNECT_ENABLED | true somente apos setup Connect testado |
| STRIPE_CONNECT_WEBHOOK_SECRET | Segredo separado do endpoint Connect |

Migrations novas dependem de auth.users e do catalogo public.products/prices.
Antes de aplicar: revisar migrations legadas, grants/RLS, backup e plano de
restauracao no projeto de homologacao escolhido. Nao executar push de todas as
migrations sobre uma base pessoal existente sem inventario. Aplicacao externa
nao foi realizada. Comparar schema real com src/types/database.ts depois.

Novas migrations, nesta ordem:

1. 20261003000000_stripe_connect_access.sql
2. 20261003000001_stripe_checkout_access.sql

Um administrador cria um Product/Price de teste na Stripe e sincroniza no
catalogo local aprovado: ativo, pagamento unico, brl, de 1 a 1000000 centavos.
Nao basta cadastrar um valor no browser. Precos divergentes na Stripe sao
recusados. Assinaturas, pagamentos de vendedor e comissoes ainda nao existem.

Checkout webhook: POST /api/stripe/checkout-webhook, somente estes eventos:
checkout.session.completed, checkout.session.async_payment_succeeded,
checkout.session.async_payment_failed e checkout.session.expired.
Connect webhook: POST /api/stripe/webhook, account.updated.
Nao apontar esses eventos para supabase/functions/stripe-webhook legado.
Endpoints desconhecidos ou ainda nao vinculados nao sao silenciosamente pagos.

## Homologacao obrigatoria

1. Confirmar plano, Spend Cap, quotas, alertas e um teto financeiro aprovado.
   Spend Cap nao limita compute/PITR e nao e um teto total da fatura.
2. Configurar um host de backend HTTPS, WAF/limites antes da invocacao,
   timeouts e logs redigidos. GitHub Pages nao executa estas rotas Next.
3. Configurar URLs de callback/confirmacao no Supabase para o dominio aprovado.
   Testar login real, confirmacao, recuperacao, expiracao e logout com dois donos.
   CAPTCHA exige integracao de token no formulario antes de ativar enforcement.
4. Aplicar migrations revisadas e conferir isolamento com usuarios distintos.
5. Ativar somente Checkout de teste. Abrir sessao, cancelar, concluir pagamento
   ficticio e receber webhook correlacionado com mesmo pedido/valor/moeda.
   Retorno do browser e somente navegacao, nunca prova de pagamento.
6. Reentregar o evento, alterar assinatura/valor e simular atraso/falha de banco.
   Conferir dedup, rollback e status paid sem regressao. Nunca simular um valor
   autentico apenas alterando o banco com uma service key.
7. Ativar Connect separadamente. Usuario inicia o cadastro hospedado; retorno
   deve consultar estado real. Pendencia/analise bloqueiam a operacao vendedor,
   mas nao exigem KYC de comprador. Repasses nao estao habilitados no app.
8. Se criacao ficar CREATING/UNCERTAIN, desligar novas tentativas e reconciliar
   no provedor pela idempotency key/metadata original. Nao apagar a reserva nem
   criar outra sessao/conta. Ferramenta de conciliacao operacional ainda pendente.

## Verificacao local reproduzivel

```sh
npm run lint
npm run typecheck
npm run test:payments
npm run test:payments:sql
npm run build
npm exec -- playwright install --with-deps chromium
npm run test:payments:e2e
npm audit --omit=dev
```

Windows com Edge instalado: definir MILLENNIUM_TEST_BROWSER_CHANNEL=msedge no
processo do terminal permite rodar a suite sem baixar Chromium. A suite usa
portas loopback 4313 e 4314 e Stripe desativada. Sessao ficticia valida apenas
o fluxo do app; nao prova autenticacao JWT real ou cadastro/pagamento na Stripe.
SQL usa PGlite efemero, nunca a conta Supabase do usuario. Artefatos ficam em
test-results, ignorados pelo Git. CI executa testes sem credenciais externas.

## Operacao futura

Faltam ensaios externos, reconciliacao operacional, monitoramento, reembolsos,
restauracao e resposta a fraude antes de liberar producao. Nada desta versao
habilita chave live, split/comissao, acesso pago legado ou aplicativo iOS.
Checkout e cadastro testados localmente nao certificam seguranca absoluta.
