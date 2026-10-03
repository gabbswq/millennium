# Millennium: pagamentos online

SPEC incremental, 3 de outubro de 2026. Gabriel esclareceu que deseja um produto
online, com contas, banco de dados, futuro app iOS e pagamentos reais apos
validacao. Local e sandbox sao etapas, nao o destino permanente do produto.
O executor de fabrica de software continua preservado; pagamentos sao a
prioridade desta trilha, sem reescrever portfolio ou landing neste incremento.

Atualizacao: Gabriel confirmou Checkout e preservacao de vendedores num menu
separado. A trilha Next/Supabase/Stripe esta detalhada em
[STRIPE_AUTH_KYC_SPEC.md](STRIPE_AUTH_KYC_SPEC.md). O laboratorio Asaas abaixo
permanece independente, sem conversao de seus dados em pedidos Stripe.

## Resultado pretendido

Gabriel acessa pelo celular uma URL HTTPS do Millennium, faz login, cria uma
cobranca Pix ficticia, ve o QR, recebe a atualizacao enviada pelo Asaas e retoma
os mesmos registros em outro dispositivo. Outra conta nao ve nem modifica seus
dados. A interface de operacao permanece escura, compacta e sem hero de marketing.

Depois da homologacao, uma release separada pode habilitar pagamentos reais e
um cliente iOS compartilhando o backend. Esse objetivo continua pendente; esta
SPEC nao declara banco, gateway operacional ou publicacao na App Store.

## Camadas e ambientes

```text
Web responsiva / futuro app iOS
           |
     Backend HTTPS: identidade verificada + autorizacao por conta
           |                         |
  PostgreSQL / Supabase Auth     Asaas Sandbox
           ^                         |
           +--- transacao <--- webhook HTTPS autenticado
```

- A landing estatica no GitHub Pages permanece apresentacao. Ela nao hospeda o
  processo Fastify nem um banco; nao colocar secrets em assets ou Actions de Pages.
- Reaproveitar o contrato Pix e Fastify do laboratorio. O modo hospedado sera
  uma entrada explicita que exige identidade e banco, sem fallback para JSON,
  sessao global de laboratorio ou login simulado. Os guardrails locais permanecem.
- PostgreSQL/Supabase e a direcao inicial, coerente com tecnologias ja presentes.
  O schema novo e independente das tabelas antigas de conteudo/Stripe. Provedor
  de hospedagem, projeto Supabase, dominio e teto de custo ainda nao definidos.
- Homologacao pode ser online e usar somente dinheiro ficticio. Producao tera
  recursos, credenciais, registros e controles separados. Nenhum flag do browser
  altera ambiente, URL do PSP ou destino dos fundos.
- Um backend hospedado com webhook HTTPS dispensa tunnel no computador. Tunnel
  opcional e temporario so serve para ensaio local e ainda nao foi autorizado.

## Identidade e autorizacao

Usar autenticacao mantida por provedor, sem criptografia ou JWT manual. Validar
sessao/token no servidor (SDK oficial, assinatura, validade e emissor); nao
confiar em sessao decodificada sem verificacao, localStorage, metadata editavel,
`owner_id` ou `account_id` enviados pelo cliente. Logout, recuperacao e sessoes
expiradas precisam ser testados. Cookies/CSRF e protecao de origem devem seguir
o fluxo de autenticacao escolhido e o dominio HTTPS aprovado.

No primeiro recorte, um workspace tem um dono. Provisionar no backend somente
apos identidade validada; os testes SQL nao implementam esse provisionamento.
Aplicar RLS e permissoes minimas em todas as tabelas novas. Service key fica
somente no servidor; consultas privilegiadas exigem filtro de conta explicito.

Passkeys podem permitir Face ID no site e no app compativel. Nao armazenar
imagem facial no Millennium. Passkey, recuperacao e dispositivos sem biometria
exigem ensaio proprio; CAPTCHA controla abuso, nao substitui autenticacao.
Aplicativo iOS, conta Apple Developer e envio/revisao da App Store sao uma etapa
posterior, sem instalacao ou publicacao automatica nesta tarefa.

## Dinheiro e persistencia

Manter centavos inteiros, pedido original imutavel, idempotencia por conta e
referencia externa unica na fonte do provedor. Nunca repetir POST com resultado
incerto. Reservar pedido em transacao, liberar transacao antes da chamada PSP,
persistir resultado; reconciliar interrupcoes sem emitir nova cobranca.

Webhook verifica token separado, origem da cobranca, cliente, metodo, valor e
referencia usando o contrato existente. Deduplica por fonte e ID; mesmo ID com
fingerprint diferente e anomalia. Transacao atomica une recibo e atualizacao,
com lock por cobranca. Responder sucesso apenas apos persistir; falhas permitem
retry. Evento antigo nao regride recebido/estornado. CONFIRMED nao e RECEIVED.

Banco continua um espelho reconciliado, nao ledger contabil nem saldo sacavel.
MVP nao inclui cartao, cripto, split, comissao ou onboarding de sellers reais.
Esses itens permanecem na visao futura; sao novos contratos, nao botoes ficticios.

## Entregas e evidencia obrigatoria

| Marco | Evidencia que prova o resultado | Estado atual |
| --- | --- | --- |
| Contrato Pix e receptor | API, navegador, falhas de disco e listener isolado | Implementado e testado; sem evento externo |
| Schema de contas | SQL executado, RLS de dois donos, grants, FKs, dedup e rollback | Implementado nesta feature; sem banco conectado ao painel |
| Identidade real | Login/recuperacao/logout/expiracao com conta de homologacao | Pendente |
| Repositorio PostgreSQL | API usando banco, duas sessoes, concorrencia e reinicio | Pendente |
| Hospedagem | URL HTTPS, custo aprovado, health check, secrets fora de assets | Pendente |
| Pix externo completo | Cobranca/QR ficticio, webhook e conciliacao correlacionados | Pendente |
| Uso no celular | Gabriel executa fluxo real e retoma em segundo dispositivo | Pendente |
| Operacao de homologacao | Logs redigidos, limites, backup/restauracao e rollback exercitados | Pendente |
| Producao | Aprovacao especifica, provedor habilitado e criterios operacionais revisados | Pendente |
| iOS | Cliente usando mesma API, autenticacao e distribuicao testadas | Pendente |

Testes de contrato nao substituem os marcos pendentes. A meta nao termina ao
passar o CI ou ao desenhar uma tela de login.

## Proxima implementacao

Conectar um repositorio PostgreSQL ao servico Pix, substituindo o contrato
sincrono de estado global por operacoes transacionais e escopo de conta.
Reutilizar as mesmas regras de dominio; nao criar outro simulador de gateway.
Testar com dois donos, duas chamadas concorrentes, webhook repetido e falha
entre reserva e resposta do provedor antes de ligar autenticacao externa.

Para recursos na nuvem, ainda precisamos escolher a conta de hospedagem/projeto
e o limite de custo. Nao criar assinatura, projeto pago, dominio ou conta Apple
sem aprovacao. Gabriel configura secrets no painel do provedor, nunca no chat
ou em arquivo de credenciais manipulado pelo agente.

## Governanca

Feature -> develop. QA, tag e preview apenas quando solicitados. Publicacao em
main somente via preview e release autorizada. Este incremento nao promove
nenhum ambiente, altera main ou expoe o painel local na rede.

## Fontes verificadas

- [Asaas: sandbox e producao separados](https://docs.asaas.com/docs/sandbox-1).
- [Asaas: notificacoes webhook](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint).
- [Supabase: RLS e grants](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: verificacao de sessao no servidor](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
- [Apple: passkeys](https://developer.apple.com/passkeys/).
- [GitHub Pages: hospedagem estatica](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
