# Millennium: Stripe, autenticacao e bloqueio KYC

Incremento solicitado em 3 de outubro de 2026. Gabriel pediu banco com Stripe,
tela inicial de autenticacao, bloqueio de acesso e publicacao em main. O fluxo
continua feature -> develop -> preview/testes/tag -> main, nunca edicao direta
da main. A release de codigo nao habilita pagamentos reais ou aplica migrations
em conta externa automaticamente.

## Direcao confirmada

Gabriel confirmou Stripe Checkout como fluxo principal e depois pediu para
preservar vendedores em um menu separado. O app Next tem entrada de login,
Checkout de compras proprias em BRL/pagamento unico e cadastro de vendedores
via Connect. KYC de vendedores nao e requisito de todo comprador. O painel
financeiro/backoffice e a interpretacao atual de "baclog"; backlog de tarefas
continua no executor separado. O laboratorio Asaas, portfolio e landing sao
preservados. Nunca converter registros de simulacao em dados financeiros Stripe.

## Contrato de acesso

1. A entrada do app Next leva ao login. A landing estatica permanece separada.
2. Sessao e identidade sao verificadas no servidor, nao somente no React.
3. Email confirmado e identidade nao anonima sao obrigatorios para onboarding.
4. KYC usa a interface hospedada Stripe. Nao coletar RG, selfie, CPF, cartao
   ou documentos num formulario local nem persistir payload bruto de identidade.
5. Voltar do onboarding nao significa aprovacao. Somente na area Vendedores,
   consultar a conta vinculada
   no servidor e verificar capabilities, charges_enabled, payouts_enabled e
   requirements. Pendencias ou respostas incompletas bloqueiam a operacao do
   vendedor, nao o Checkout de compras proprias. Repasses/splits/comissoes ainda
   nao sao implementados e nao sao anunciados como operacionais.
6. Vinculo Stripe pertence ao usuario autenticado e e imutavel pelo cliente.
   RLS e grants minimos; uma reserva por usuario e claim atomico antes do POST.
   RPCs de reserva/claim so aceitam service_role; usuario vem de getUser no
   servidor, nunca de corpo de requisicao ou metadata editavel.
7. Criacao ambigua preserva estado e nao repete POST automaticamente. Somente
   uma chamada pode adquirir a reserva; idempotency key persistida na base.
8. SDK oficial, keys apenas no ambiente e default desativado. Este incremento
   aceita exclusivamente chave de teste; producao exige release separada.
9. Webhook exige assinatura Stripe no corpo original, limite de tamanho,
   livemode false, evento idempotente e persistencia antes do sucesso.
10. Nao expor Account Link em logs, emails ou chat; emitir somente para o dono
    autenticado. URLs de retorno pertencem ao dominio aprovado do aplicativo.
11. Checkout recebe apenas price_id e request_id UUID. Catalogo ativo, valor,
    moeda, Stripe Price e conta de destino vem do servidor/banco. Conferir o
    preco remoto Stripe antes de criar sessao. Cliente nao define valor, conta,
    transfer_data, destination ou URLs de retorno. Nenhum split nesta etapa.
12. Pedido persistido antes do POST, idempotency key estavel e claim atomico.
    Um pedido pendente por dono/preco, reutilizavel em outro dispositivo. Falha
    ambigua fica CREATING/UNCERTAIN e exige conciliacao; nao repetir criacao.
13. Webhook de Checkout usa endpoint/segredo separado do Connect. So eventos
    assinados de teste da plataforma; confirmar session, owner, valor e moeda
    contra pedido persistido. completed/unpaid nao vira paid. Atualizacao e
    recibo deduplicado sao uma transacao; evento antigo nao regride paid.
14. Pagamentos de teste nao concedem acesso ao conteudo pago legado. Fluxos
    antigos de Edge Functions nao fazem parte desta integracao: nao implantar
    create-checkout/stripe-webhook legados para este incremento.

## Limites de abuso e custo

- Limite de corpo: 1 KiB nas criacoes, 64 KiB nos webhooks. Erros publicos sem
  payloads, chaves ou detalhes de infraestrutura. Cookies no-store e origem
  obrigatoria nas mutacoes; sessao verificada no servidor e email confirmado.
- Proxy de imagens nao aceita hosts arbitrarios: somente storage publico do
  projeto Supabase HTTPS configurado e assets locais. Novos hosts exigem revisao.
- Backpressure por processo antes das chamadas de criacao/autenticacao: 60
  requisicoes de Checkout/minuto, 30 de onboarding/minuto, 120 por webhook e
  120 verificacoes de identidade/minuto. Por usuario: 5 Checkouts/minuto,
  3 onboardings/minuto, 6 consultas Stripe/minuto, 30 identidades/minuto.
- SQL serializa reservas e limita novas criacoes a 100 Checkouts/dia global,
  5/dia por usuario e 25 contas de vendedor/dia global. Reutilizacao nao cria
  outra sessao/conta. Estes limites sao de teste, nao valores monetarios nem
  quotas autorizadas de producao; UTC no Supabase deve ser confirmado.
- Limite em memoria NAO e global entre replicas e reinicia com o processo.
  SQL global protege criacoes, mas trafego rejeitado tambem pode consumir
  compute, autenticacao e banda. Falta WAF/rate limit de borda, timeouts no
  host, alertas, runbook de desligamento e ensaio de ataque antes da exposicao.
- Supabase Spend Cap do Pro cobre somente itens definidos pelo provedor, nao
  todos os gastos (compute/PITR e outros ficam fora). Conta existe segundo
  Gabriel. Projeto pywotovmlxzwwpawpaew/plano Free/schema e advisors foram
  verificados em 4 de outubro; WAF/limites remotos de trafego e alertas financeiros
  continuam pendentes. [Evidencia](SUPABASE_BOOTSTRAP_EVIDENCE.md).
  A foto de custos de terceiros nao e tabela atual nem orcamento aprovado.
- Nao contratar simultaneamente AWS, Railway, Vercel e outros so por constarem
  na foto. Escolher um host de backend e o projeto Supabase, com custo aprovado.
- Chaves de teste exclusivamente no ambiente do servidor, nunca no Git/chat.
  STRIPE_CHECKOUT_ENABLED e STRIPE_CONNECT_ENABLED sao independentes e false
  por padrao. STRIPE_SECRET_KEY live e recusada. Nenhum dinheiro real habilitado.

## Aceite

- Testes de dominio para todos os estados, dados incompletos e redirect malicioso.
- SQL executado: isolamento de donos, claim concorrente, grants e eventos duplicados.
- Rotas sem login retornam 401 ou redirecionam; email pendente nao abre o painel.
- Vendedores e Checkout sao menus separados. Sem configuracao, a interface
  informa indisponibilidade e nao cria conta/sessao; nao usar mocks no app.
- Build, tipos e navegador em desktop/celular, sem overflow ou erros do app.
- Onboarding, emails, webhook e login reais de testes continuam pendentes ate
  configuracao humana das contas e ensaio externo observado.
- CI de feature/develop/preview aprovado antes de release main; backup/tag
  verificavel. Main nao e endereco de um backend hospedado.

## Referencias

- [Onboarding hospedado](https://docs.stripe.com/connect/hosted-onboarding).
- [Estado e requirements](https://docs.stripe.com/connect/handling-api-verification).
- [Assinatura de webhook](https://docs.stripe.com/webhooks).
- [Verificacao Supabase no servidor](https://supabase.com/docs/guides/auth/server-side/nextjs).
- [Confirmacao Checkout](https://docs.stripe.com/payments/checkout/fulfill-orders).
- [Controle de custo Supabase](https://supabase.com/docs/guides/platform/cost-control).
- [Guia de configuracao](STRIPE_CHECKOUT_SETUP.md).
