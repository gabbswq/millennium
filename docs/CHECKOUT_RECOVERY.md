# Recuperacao de Checkout de teste

Ferramenta operacional restrita ao terminal. Nao e endpoint publico, nao
cria sessao, nao cobra, nao marca pagamento como paid e nao concede acesso.
Usa os SDKs oficiais ja instalados; nenhuma dependencia adicional.

## Antes de executar

1. Desligar novas criacoes com STRIPE_CHECKOUT_ENABLED no host autorizado,
   preservando o receptor de webhook assinado. Nao editar .env neste fluxo.
2. Conferir o projeto Supabase escolhido, schema aplicado e permissao de operar.
   Ter NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e STRIPE_SECRET_KEY
   disponiveis apenas no ambiente seguro do processo. Nao colar valores no
   chat/Git; nao fornecer credenciais por argumentos do comando.
3. Localizar o UUID original de stripe_checkout_requests e a sessao existente
   no Dashboard Stripe em teste pela metadata millennium_checkout_id.
   Nunca escolher uma sessao apenas por email ou valor parecido. Se a sessao
   nao for encontrada, nao criar outra nem apagar/zerar a reserva.
4. Aguardar pelo menos dois minutos desde updated_at para nao disputar com a
   chamada original. Copiar os IDs, nao URL, dados pessoais ou payload bruto.

O comando aceita somente host HTTPS ref.supabase.co e chave sk_test_. Nao
usa .env automaticamente, nao aceita host arbitrario, chave live, mocks por
variavel de ambiente ou fallback local. CLI ajuda nao exige credenciais.
Use Node com as dependencias da copia de develop instalada, preferencialmente
no Ubuntu/WSL conforme README.

## Inspecionar primeiro

```sh
npm run payments:recover-checkout -- --help
npm run payments:recover-checkout -- --checkout 'UUID_DO_PEDIDO' --session 'cs_test_ID_DA_SESSAO'
```

Substituir os dois placeholders por IDs reais de teste. Sem --bind-open, ha
somente uma leitura de pedido no Supabase e uma leitura de sessao na Stripe,
com line_items expandido. Nao lista clientes/pagamentos e nao faz paginacao.
Timeout de 10s por chamada; retries automaticos desativados nos dois SDKs.
Uma aplicacao explicita pode adicionar um unico PATCH condicional no Supabase,
mas nenhum POST na Stripe. Isso e limite desta operacao, nao teto de custo do
produto ou protecao contra todo trafego externo.

Validacoes: pedido original, dono, sessao test-only hospedada (hosted_page na
API do SDK Stripe 23), metadata, BRL, valor/subtotal, preco original, quantidade
um, ausencia de itens truncados e timestamps coerentes. Nao confiar em JSON
fornecido pelo operador nem em metadata de usuario. A sessao vem de GET
autenticado na Stripe. Saida contem somente IDs, outcome e applied, sem URL
de Checkout, dados pessoais, chaves ou mensagens brutas do provedor.

## Resultado e aplicacao explicita

| outcome | Acao |
| --- | --- |
| READY_TO_BIND | Sessao aberta e compativel; nenhuma escrita feita |
| OPEN_SESSION_BOUND | Sessao aberta vinculada; payment_state continua pending |
| ALREADY_BOUND | Mesmo vinculo ja existe; nenhuma escrita feita |
| TERMINAL_SESSION_REQUIRES_REVIEW | Sessao concluida/expirada; nao alterar reserva automaticamente |

Somente apos revisar READY_TO_BIND e autorizar a escrita:

```sh
npm run payments:recover-checkout -- --checkout 'UUID_DO_PEDIDO' --session 'cs_test_ID_DA_SESSAO' --bind-open
```

O PATCH compara UUID/dono/request_id, estado CREATING ou UNCERTAIN, timestamp
original e campos de vinculo nulos. Nao sobrescreve outro operador, a resposta
original ou uma mudanca de pagamento. Pode ser usado com novas criacoes
desligadas; nao depende da flag publica de Checkout estar ativa.

CONCURRENT_CHANGE_READ_AGAIN exige uma nova inspecao sem --bind-open.
BIND_OUTCOME_UNCONFIRMED_READ_AGAIN significa que a resposta do banco se
perdeu: a escrita pode ter ocorrido. Ler novamente, nunca assumir rollback
nem repetir mutacao sem revisar o estado. Se ALREADY_BOUND, nao houve novo
vinculo nem nova cobranca. Erros de leitura nao sao prova de sessao inexistente.

Sessao terminal nao e recuperada automaticamente por esta ferramenta porque
o schema original exige URL no vinculo e a Stripe pode retorna-la como null.
Nao inventar URL nem usar service key para marcar paid. Revisar com o provedor
e implementar um fluxo transacional autorizado antes de liberar esse caso.
Se o pedido ja esta BOUND, usar a reentrega do evento original assinado no
endpoint de Checkout correto; o backend deduplica e confere owner/valor/moeda.
Voltar do Checkout ou receber um relato do cliente nunca prova pagamento.

Stripe pode remover idempotency keys apos pelo menos 24h; repetir criacao
depois disso pode produzir outra sessao. Nao usar um novo POST como procura
por uma sessao antiga. Consulte
[idempotencia Stripe](https://docs.stripe.com/api/idempotent_requests),
[GET da sessao](https://docs.stripe.com/api/checkout/sessions/retrieve) e
[itens de linha](https://docs.stripe.com/api/checkout/sessions/line_items).

## Evidencia e limites

Testes exercitam o dominio, parser/CLI real sem credenciais, SDKs oficiais com
transporte interceptado e PATCH com filtros exatos. SQL descartavel exercita
compare-and-set, isolamento/imutabilidade existentes e concorrencia nativa
no CI PostgreSQL 17/18. Nenhum ensaio aponta para a conta Supabase de Gabriel
ou uma Stripe real; testes automaticos nao substituem homologacao externa.

Nenhuma DDL/migration nova: usa grants e triggers existentes. Nao resolve
sessao terminal sem vinculo, ausencia de sessao ou conciliacao de Connect.
Vendedores permanece um menu separado. Backend HTTPS, WAF, configuracao
segura, atualizacao PostgreSQL e testes reais continuam nos gates de
[setup](STRIPE_CHECKOUT_SETUP.md) e
[preflight Supabase](SUPABASE_PROJECT_PREFLIGHT.md).
