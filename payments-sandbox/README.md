# Millennium: laboratorio Pix

Incremento de aprendizagem separado da landing, do executor de agentes e do
checkout Next/Stripe antigo. A tela usa uma API Fastify e armazenamento local
persistente. Nao e um gateway pronto para producao.

O destino pretendido e Millennium online, com contas, banco, futuro iOS e
pagamentos reais apos validacao. Local e sandbox sao etapas diferentes: uma
aplicacao hospedada tambem pode usar dinheiro ficticio. Veja a
[SPEC online](../docs/PAYMENTS_ONLINE_SPEC.md) e a [base SQL](database/README.md).
O schema esta preparado para testes; o painel ainda nao usa PostgreSQL ou login.

## Abrir agora no VS Code

Na copia de desenvolvimento deste computador, use o terminal Ubuntu/WSL:

```sh
cd /mnt/c/Users/gabbs/Documents/ChatGPT/M/millennium
code .
```

O checkout pessoal `~/ai-projects/gabbs-product-factory` permanece separado.
Nao o resete nem copie estas pastas por cima das alteracoes que ja existem.
Confirme **WSL: Ubuntu** no VS Code. Node 20+ e npm sao requisitos.

Em **Terminal > Executar Tarefa**, rode **Millennium Pix: instalar laboratorio**
uma vez e depois **Millennium Pix: iniciar simulador**. Abra a URL impressa
no terminal. O padrao e `http://127.0.0.1:4311`; se estiver ocupada, o servidor
escolhe outra porta e informa o endereco. Pare com Ctrl+C nesse terminal.

Os mesmos comandos na raiz do repositorio:

```sh
npm --prefix payments-sandbox ci --ignore-scripts
npm run pix:dev
```

Nao precisa instalar as dependencias Next.js da raiz. Em outra maquina, clone
`develop` em uma pasta nova, abra a raiz e use os comandos npm acima.

## Primeiro teste manual

1. Crie uma cobranca com descricao ficticia, R$ 10,01 e vencimento valido.
2. Veja o registro pendente e o QR marcado como **simulacao, nao pagavel**.
3. Concilie: a consulta deve preservar o mesmo ID e nao criar outra cobranca.
4. Simule recebido e depois estornado; confira os totais e a aba Eventos.
5. Recarregue: os registros devem continuar presentes.
6. Tente um valor acima de R$ 10.000,00: deve aparecer erro, sem novo registro.

O vendedor fixo e uma loja ficticia. No simulador, o QR identifica o teste;
nao e um Pix copia e cola valido. Nenhum passo acima movimenta dinheiro.

## Asaas Sandbox: etapa separada

O adaptador implementa criacao Pix, QR fornecido pelo provedor e consulta por
ID/referencia. O modo so inicia com `--asaas`, nao faz fallback silencioso e
usa exclusivamente `https://api-sandbox.asaas.com/v3`, sem redirecionamentos.

Para testar chamadas externas, primeiro crie sua conta em
[Asaas Sandbox](https://sandbox.asaas.com/), um **cliente comprador ficticio** e
uma chave dessa conta de testes. O cliente nao representa o vendedor. Nao
use documentos de pessoas reais nem chaves de producao. Nao envie segredos
ao chat, nao crie um arquivo `.env` e nao grave os comandos com os valores.

No terminal Bash do Ubuntu, as leituras abaixo recebem os valores sem exibir
a chave/token nem inclui-los no historico de comandos. Execute pessoalmente:

```sh
read -r -s -p 'Chave Asaas Sandbox: ' ASAAS_SANDBOX_API_KEY
printf '\n'
read -r -p 'ID cus_ do comprador ficticio: ' ASAAS_SANDBOX_CUSTOMER_ID
read -r -s -p 'Token separado de webhook (32-255 caracteres): ' ASAAS_SANDBOX_WEBHOOK_TOKEN
printf '\n'
export ASAAS_SANDBOX_API_KEY ASAAS_SANDBOX_CUSTOMER_ID ASAAS_SANDBOX_WEBHOOK_TOKEN
npm run pix:dev -- --asaas
unset ASAAS_SANDBOX_API_KEY ASAAS_SANDBOX_CUSTOMER_ID ASAAS_SANDBOX_WEBHOOK_TOKEN
```

O token de webhook deve ser aleatorio, sem espacos e diferente da chave da API.
Depois de parar o servidor, execute o `unset`. As variaveis sao herdadas pelo
processo local e nao sao persistidas pela aplicacao.

A API local aceita `/webhooks/asaas` com o header `asaas-access-token`, valida
o pagamento e deduplica o ID do evento. **Asaas nao consegue entregar eventos
diretamente em 127.0.0.1.** O painel continua rejeitando hosts externos. Agora
existe um receptor opcional, separado e sem painel/API de consulta, ativado
somente com `--asaas --webhook-port 4312`. Ele compartilha o estado e valida o
mesmo token antes de ler o JSON. Transporte HTTPS externo exige autorizacao
expressa; nenhum tunnel foi instalado ou aberto.

O [roteiro de webhook sandbox](WEBHOOK_SANDBOX.md) explica as duas portas,
configuracao futura no provedor e evidencias necessarias. Use Conciliar para
uma consulta explicita enquanto a entrega externa nao estiver homologada.

Nao marcar homologacao concluida com fixtures: faltam cobranca, QR, mudanca
de estado, conciliacao e entrega de webhook observadas no sandbox externo.

## Verificar automaticamente

Na raiz, em outro terminal (ou usando as tarefas de testes do VS Code):

```sh
npm --prefix payments-sandbox exec -- playwright install chromium
npm run pix:verify
npm run test:millennium
```

`pix:verify` compila a tela, testa API/dominio e abre Chromium desktop/mobile.
Fixtures nao usam chaves reais nem chamam a rede do provedor. Os testes cobrem
idempotencia, concorrencia, timeout, conciliacao sem repetir POST, webhook
autenticado/duplicado/antigo, persistencia, formulario, QR, teclado e 320px.
O build limita o JavaScript a 60 KB. O CI executa os mesmos testes em Node 22;
nao publica nem usa secrets financeiros.

## Dados, limites e arquivos

Estado privado em `.payments-sandbox/simulator/` ou `.payments-sandbox/asaas/`,
ignorado pelo Git. Um processo por modo/pasta; nao edite o JSON durante uso.
Criacao interrompida fica incerta e exige conciliacao, nao novo POST.
Mesma chave/corpo recupera a cobranca mesmo apos o vencimento. Referencia
ambigua ou valores divergentes nao sao tratados como recebimento.

Dinheiro e inteiro em centavos. CONFIRMED nao entra no total RECEIVED.
Capacidade local: 1.000 cobrancas e 10.000 eventos, sem limpeza automatica.
A lista nao retransmite imagens; somente o detalhe selecionado carrega o QR.
O poll da tela consulta apenas registros locais, nunca o provedor.

| Arquivo | Responsabilidade |
| --- | --- |
| `web/` | Formulario, tabela, QR, estados e eventos |
| `app.mjs` | Rotas, validacao, CSRF e origem local |
| `service.mjs` | Criacao, idempotencia, conciliacao e webhooks |
| `webhook-receiver.mjs`, `http.mjs` | Listener exclusivo e contrato HTTP compartilhado |
| `providers.mjs` | Simulador e adaptador fixo Asaas Sandbox |
| `repository.mjs` | Persistencia atomica e lock de processo |
| `domain.mjs` | Centavos, contratos e transicoes |
| `tests/`, `browser-tests/` | Testes API e navegador |

Nao ha autenticacao multiusuario, ledger contabil, cadastro real de sellers,
split, comissao, saque, estorno enviado ao PSP, cartao ou producao. O armazenamento
JSON e sincrono e de processo unico: adequado ao laboratorio, nao a operacao
financeira. Nao e um resultado medido de latencia ou escalabilidade.
Recuperacao de lock morto e serializada; um arquivo `server.lock.recovery`
abandonado faz o inicio falhar de forma conservadora. Preserve o estado e
verifique os processos antes de qualquer recuperacao manual; nao apague locks
para forcar duas instancias.

[SPEC e criterios de aceite](../docs/PIX_SANDBOX_SPEC.md).
Fontes: [ambiente sandbox](https://docs.asaas.com/docs/faq-sandbox-1),
[cobranca Pix](https://docs.asaas.com/reference/criar-nova-cobranca),
[QR](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix),
[webhooks e token](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint).
