# Millennium: prova Pix em sandbox

SPEC de incremento, 3 de outubro de 2026. Gabriel priorizou pagamentos em
sandbox; o painel de agentes foi adiado. Esta aplicacao de aprendizagem fica
separada do executor de turnos, da landing e do experimento Next/Stripe.

Gabriel esclareceu depois que o destino e um produto online, com contas,
banco, futuro iOS e pagamentos reais apos validacao. Esta SPEC continua
definindo o laboratorio inicial; a continuidade esta em
[PAYMENTS_ONLINE_SPEC.md](PAYMENTS_ONLINE_SPEC.md). Nao confundir onde o sistema
roda (local/web) com o ambiente financeiro (sandbox/producao).

## Resultado pretendido

Abrir um laboratorio no computador, criar uma cobranca ficticia de um vendedor
ficticio, inspecionar o QR/codigo, acompanhar estado e testar recebimento,
duplicacao, falha e conciliacao. Nenhuma transacao real, comissao, saque,
cadastro de comerciante real, split ou conta bancaria entra neste incremento.

## Modos que nao podem ser confundidos

- `simulator`: sem credenciais e sem rede externa. Gera um QR de identificacao
  do teste, nao um payload Pix pagavel. Simula eventos explicitamente.
- `asaas`: somente `https://api-sandbox.asaas.com/v3`; exige chave, cliente e
  token de webhook do sandbox inseridos diretamente no ambiente local. Nao
  permite URL de producao, redirecionamentos ou mudanca de host pelo navegador.
  Criacao e consultas acontecem apenas por uma acao explicita.

Os registros ficam separados por modo e privados no projeto. A API e a tela
escutam apenas em 127.0.0.1. Nao expor automaticamente um tunnel. Webhook
Asaas vindo da rede exige uma etapa posterior de transporte HTTPS; testes
locais de contrato nao comprovam entrega real do provedor.

## Contrato

1. Dinheiro e inteiro em centavos; aceitar apenas BRL e valores de teste entre
   R$ 0,01 e R$ 10.000,00. Criar com descricao e data validas.
2. Chave de idempotencia obrigatoria. Mesma chave/mesmo corpo recupera o registro;
   mesma chave/outro corpo falha. Reservar antes da chamada externa.
3. Timeout ou resposta ambigua de criacao nao autoriza repetir um POST.
   Preservar a referencia e consultar/conciliar antes de outra decisao.
4. QR vem do provedor no modo Asaas; falha ao recuperar QR nao cria outra
   cobranca. Simulacao nao e apresentada como homologacao aprovada.
5. Validar token de webhook em tempo constante, deduplicar pelo ID do evento e
   conferir cobranca, valor, cliente e metodo. Nao reconhecer CONFIRMED como
   RECEIVED; nao regredir um recebido/estornado por evento antigo.
6. Conciliar por ID externo ou externalReference, sem criar pagamentos. Mais
   de um resultado ou dados divergentes geram anomalia, nao aceite otimista.
7. Persistir antes de confirmar processamento. Um processo por pasta de dados;
   registros corrompidos ou links simbolicos nao sao sobrescritos.
8. API local com validacao JSON Schema, limites de corpo, protecao de origem/CSRF,
   sem segredos no navegador, logs ou repositorio. O laboratorio nao substitui
   uma arquitetura de producao, autenticacao multiusuario ou ledger financeiro.

## Evidencias de aceite

- Suite automatizada cobre validacao, concorrencia/idempotencia, timeout,
  resposta ambigua, QR indisponivel, webhook invalido/duplicado/fora de ordem,
  conciliacao, persistencia e barreiras de producao.
- Testes de navegador verificam formulario, estado, QR, simular recebimento,
  recarga, erros e layout em desktop e celular. Dados sao ficticios.
- Homologacao Asaas so pode ser marcada concluida com cobranca/QR, mudanca de
  estado, conciliacao e webhook reais do sandbox registrados e redigidos,
  sem publicar credenciais ou dados pessoais.
- Gabriel deve percorrer o fluxo e explicar entrada, API, estado e teste.
  A observacao humana permanece separada dos testes tecnicos.
- Implementar em `feature/pix-sandbox`, integrar somente em `develop`.
  Sem preview, tag, main ou publicacao da aplicacao sem novo pedido.

## Estado tecnico da primeira entrega

Validacao local em Ubuntu/WSL, Node 20.20.2: `npm run pix:verify` passou com
29 testes de API/dominio e 12 testes Chromium desktop/mobile. QR inspecionado
por pixels; layout e valores verificados em 1440, 360 e 320px. JavaScript
minificado de 12.111 bytes, sem CDN ou scripts remotos. A lista consulta apenas
dados locais e nao retransmite todos os QRs. O executor anterior passou seus
32 testes; nao foram feitas chamadas de IA neste laboratorio.

`npm --prefix payments-sandbox audit --omit=dev` informou zero vulnerabilidades
conhecidas nessa execucao. Isso nao equivale a uma auditoria de seguranca nem
a garantia sobre dependencias futuras.

**Nao homologado externamente.** Nao havia credenciais de testes disponiveis
no ambiente verificado. Criacao/QR/consulta Asaas foram exercitados somente
com fixtures locais. Webhook externo depende de transporte HTTPS ainda nao
aberto/autorizado. Aceite de uso por Gabriel tambem continua pendente.

## Incremento de continuidade: receptor isolado

Na feature `feature/pix-webhook-receiver`, o servidor recebe a opcao explicita
`--asaas --webhook-port 4312`. Um segundo listener loopback registra somente
POST `/webhooks/asaas`, sem painel, assets, sessao, consulta ou criacao. Nao
abre tunnel, nao permite modo simulador e nao usa uma segunda instancia de
armazenamento. O painel original conserva Host local e CSRF.

O token e verificado antes de ler o JSON; regras de valor/cliente/referencia,
deduplicacao e persistencia sao compartilhadas. Fechar o painel drena eventos
do receptor antes de liberar o lock. Porta do receptor ocupada causa falha,
sem fallback que possa fazer um tunnel apontar para outro processo.

Validacao local deste incremento: `npm run pix:verify` passou com 39 testes
de API/dominio (10 do receptor) e 12 de navegador. Dois listeners TCP reais
com fixtures comprovaram compartilhamento de estado, isolamento do painel e
fechamento sem liberar o lock antes de concluir o evento ativo. Uma falha de
disco nao devolve 200 nem consome o ID do evento, permitindo retry posterior.
O bundle do navegador permanece em 12.111 bytes; nao houve mudanca visual.

O [roteiro externo e matriz de aceite](../payments-sandbox/WEBHOOK_SANDBOX.md)
separa testes locais de HTTPS, cobranca/QR, evento/conciliacao reais e uso
humano. Entrega do provedor continua nao verificada. Integracao apenas na
develop; nenhuma promocao QA/main, publicacao ou registro externo automatico.

## Referencias verificadas

- [Sandbox e independencia de producao](https://docs.asaas.com/docs/faq-sandbox-1).
- [Criar cobranca Pix](https://docs.asaas.com/reference/criar-nova-cobranca).
- [QR dinamico](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix).
- [Consulta por referencia](https://docs.asaas.com/reference/listar-cobrancas).
- [Eventos e token de webhook](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint).
- [Validacao Fastify](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).
