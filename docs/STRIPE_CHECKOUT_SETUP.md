# Millennium: Checkout e Vendedores em homologacao

Codigo de teste, nao gateway financeiro pronto. O schema do projeto Supabase
autorizado foi preparado em 4 de outubro; Auth/Stripe/runtime nao estao conectados.
Configure por canais seguros do provedor; nao
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
| NEXT_PUBLIC_AUTH_CAPTCHA_ENABLED | true apos preparar Turnstile e enforcement Auth |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Site key publica; segredo privado somente no Supabase Auth |
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
migrations sobre uma base pessoal existente sem inventario. Projeto
pywotovmlxzwwpawpaew recebeu a cadeia completa mais os dois ajustes de grants;
[evidencia e alertas restantes](SUPABASE_BOOTSTRAP_EVIDENCE.md).

Novas migrations, nesta ordem:

1. 20261003000000_stripe_connect_access.sql
2. 20261003000001_stripe_checkout_access.sql
3. 20261003000002_auth_access_hardening.sql
4. 20261004123048_content_privileges_hardening.sql
5. 20261004150302_private_featured_snapshot.sql

A terceira corrige a recursao das policies de public.users, limita PATCH do
perfil a display_name/avatar_url/metadata e reserva identidade/email/role ao
servidor. Metadata continua editavel e nunca deve autorizar acesso. Vinculos
OAuth passam a ser gravados exclusivamente pelo servidor usando identities
retornadas por auth.getUser(token), nao user_metadata ou IDs enviados pelo
browser. Novas chamadas sync-provider enviam somente provider, com corpo de
ate 1 KiB e backpressure local; nao usar clientes antigos para essa rota.

Perfis/authors sao views invoker privadas: dono/admin, sem diretorio anonimo.
Jobs de publicacao/refresh sao service_role-only com EXECUTE explicito;
BYPASSRLS nao dispensa esse privilegio. Precos continuam publicamente legiveis
quando ativos, mas so administradores confiaveis podem altera-los. O cliente
nao recebe o raw_event de pagamentos legados. Conferir grants de coluna e
dono das funcoes no banco escolhido; os testes usam um dono privilegiado
descartavel, nao certificam automaticamente a configuracao de qualquer projeto.

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
   Formularios suportam CAPTCHA opt-in. Configurar widget/variaveis e ativar
   enforcement no Supabase conforme [runbook](AUTH_ABUSE_PROTECTION.md).
   Guard no cliente sozinho nao protege chamadas diretas a API de Auth.
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
   criar outra sessao/conta. [Ferramenta de recuperacao](CHECKOUT_RECOVERY.md)
   inspeciona por padrao e pode vincular explicitamente somente sessao aberta
   de teste, com dados conferidos e compare-and-set. Sessao terminal sem
   vinculo e recuperacao Connect continuam exigindo fluxo autorizado separado.

## Verificacao local reproduzivel

```sh
npm run lint
npm run typecheck
npm run test:payments
npm run test:payments:sql
npm run build
npm exec -- playwright install --with-deps chromium
npm run test:payments:e2e
npm run test:auth:captcha:e2e
npm audit --omit=dev
```

Windows com Edge instalado: definir MILLENNIUM_TEST_BROWSER_CHANNEL=msedge no
processo do terminal permite rodar a suite sem baixar Chromium. A suite usa
portas loopback 4313 e 4314 e Stripe desativada. Sessao ficticia valida apenas
o fluxo do app; nao prova autenticacao JWT real ou cadastro/pagamento na Stripe.
CAPTCHA usa outra fixture loopback (4315/4316) e SDK ficticio interceptado
somente pelos testes. Rodar sequencialmente, pois compartilham .next-e2e.
SQL local usa PGlite efemero com a cadeia inteira de migrations, incluindo
unaccent e defaults historicos permissivos. Reproduz a recursao anterior antes
de aplicar a correcao. CI repete a suite em PostgreSQL 17 e 18 e adiciona seis
ensaios multiconexao: reservas/claims de Checkout e vendedor, webhook duplicado,
limites globais de 100 Checkouts/25 cadastros por dia e vinculo de recuperacao
compare-and-set entre operadores concorrentes.
Localmente esses seis ensaios ficam explicitamente SKIP sem PostgreSQL nativo.

Para o ensaio nativo, MILLENNIUM_TEST_DATABASE_URL aceita somente uma base
loopback vazia com nome millennium_test_*. Recusa URL remota, query/hash,
objetos existentes ou roles Supabase ja existentes, antes de alterar schema.
Nunca apontar para uma conta Supabase, base pessoal, producao ou staging.
Artefatos ficam em test-results, ignorados pelo Git. CI usa apenas fixtures
descartaveis, sem credenciais externas e sem pagamentos.

Limites SQL restringem criacoes de recursos, nao requisicoes recusadas,
trafego ou fatura. Backpressure em memoria vale por processo e nao substitui
WAF, controles de custo do provedor ou teste de abuso externo. npm audit
omit=dev limpo nao inclui os alertas ainda existentes em ferramentas dev.

Referencias: [RLS e grants](https://supabase.com/docs/guides/database/postgres/row-level-security),
[metadata editavel](https://supabase.com/docs/guides/auth/users),
[contrato JSON de identidade do GoTrue](https://github.com/supabase/auth/blob/master/internal/models/identity.go).

## Operacao futura

Faltam ensaios externos, reconciliacao de casos terminais/Connect, monitoramento, reembolsos,
restauracao e resposta a fraude antes de liberar producao. Nada desta versao
habilita chave live, split/comissao, acesso pago legado ou aplicativo iOS.
Checkout e cadastro testados localmente nao certificam seguranca absoluta.
