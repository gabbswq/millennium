# Passagem de turno: Millennium

Registro de 1 de outubro de 2026. Revalidar antes de continuar.

## Meta de seguranca: APIs e CI, 4 de outubro

Gabriel pediu foco defensivo usando Anthropic-Cybersecurity-Skills. Projeto
comunitario, nao da Anthropic; tres guias revisados na revisao 54a79883,
sem instalar a biblioteca ou executar seus scripts. Novo modelo de ameacas,
criterios e gates em [SECURITY_PROGRAM.md](SECURITY_PROGRAM.md).

Feature security-api-bounds parte de develop e9387f3c. Quatro testes falharam
antes da correcao: corpo sem deadline, cancelamento travado, desconexao ignorada
e 429 sem Retry-After. Leitura agora tem prazo total 5s, abort/cancel/liberacao,
bytes preservados e limites anteriores. Sync-provider limitado antes de ler;
429 local informa janela real. Dez testes novos, sem novas dependencias/migrations.
Patches/minors compativeis no lockfile reduziram audit completo de 35 para
7 entradas high dev/transitivas; audit completo nao esta aprovado. Nao usar
force/downgrade/migracao Tailwind major; risco e tratamento no programa.
CodeQL JS/TS adicionado em CI, SHAs oficiais fixos, sem agenda ou segredos.
Codigo 216f0357 aprovado no [CI](https://github.com/gabbswq/millennium/actions/runs/37214121308):
67 dominio/auth, 40 SQL nativos por versao (17/18, zero SKIP), 12 navegador,
12 CAPTCHA, lint/build e audit producao zero alertas conhecidos. 131 casos
unicos, nao somar matriz/PGlite. [CodeQL](https://github.com/gabbswq/millennium/actions/runs/37214121334)
executou e encontrou 11 alertas abertos, 10 high/1 medium. Trechos revisados,
sem supressoes ou reproducao ainda; [triagem e proximo turno](SECURITY_SCAN_BASELINE.md).
Integrar so develop; esse baseline nao e aceite humano de seguranca ou release.

Nenhuma operacao cloud/pentest, credencial, plano ou pagamento alterado.
Main/preview preservadas. Supabase schema ja concluido na etapa abaixo;
patch Postgres, WAF/orcamento, Auth real e Stripe TEST externo seguem gates.

## Schema Supabase autorizado, 4 de outubro

Gabriel autorizou tabelas/permissoes em pywotovmlxzwwpawpaew, sem mudar plano
ou habilitar pagamentos reais. Develop de origem: 802d2ffc. Feature
supabase-authorized-bootstrap adiciona duas migrations de grants/snapshot,
quatro testes SQL, um probe cloud transacional e documentacao. Dez migrations
anteriores intactas; historico remoto reconciliado e comparado com as 12 locais.
[Evidencia, procedimento, advisors e proximos gates](SUPABASE_BOOTSTRAP_EVIDENCE.md).

18 tabelas com RLS. Plano Free confirmado antes/depois. Probe real passou:
dono, segundo dono, anon, campos privados, papel e writes privilegiados.
Claims SQL sinteticas, nao login/JWT reais; rollback confirmou zero contas,
produtos e reservas de teste persistidos. Sem chamadas Stripe/credenciais.
SQL local: 34/40 PGlite, seis SKIP de concorrencia nativa. Codigo
f6219db32e157a2411ff9ed6a7628c724a6a3b43 aprovado no
[CI da feature](https://github.com/gabbswq/millennium/actions/runs/37212020872):
57 dominio/auth, 40 SQL nativos por versao (17/18, zero SKIP), 12 navegador
e 12 CAPTCHA. Sao 121 casos unicos, sem somar matriz/PGlite. Lint, build e
audit omit=dev aprovados; zero vulnerabilidades conhecidas de producao nao
certifica dependencias dev nem a seguranca completa. Integrar apenas develop.

Snapshot featured_articles agora exclusivo do servidor; public_articles segue
invoker/RLS. Defaults antigos davam permissoes alem de RLS, agora revogadas nos
objetos de conteudo e em defaults postgres para futuros objetos. CLI local
2.119.0 verificado, sem instalacao global; cache supabase/.temp ignorado.

Gate remoto continua: patch PostgreSQL 17.4.1.075. Nao atualizar/reiniciar ou
mudar plano sem autorizacao e recuperacao planejada. Advisors de descoberta
GraphQL/helpers definer intencionais documentados, performance em backlog.
Meta ampla nao concluida: faltam runtime HTTPS/orcamento, Auth/CAPTCHA/emails,
WAF/quotas/alertas e ensaio Stripe test-only com webhook. Main/preview preservadas.

## CAPTCHA de Auth, 4 de outubro

Feature auth-captcha parte de develop 0daa804f. Formularios enviam token
Turnstile nativo ao Supabase no login com senha, cadastro, recuperacao e
reenvio. Opt-in, sem alteracao de .env, segredos, migrations ou planos.
Token efemero e consumido por tentativa; ausencia/expiracao/erro bloqueiam
submissao. Widget adapta tamanho e limpa instancia na navegacao. Reenvio
recusado nao mostra sucesso. OAuth nao usa o CAPTCHA deste formulario.
[Setup, limites e gates](AUTH_ABUSE_PROTECTION.md).

Local: lint, tipos, 57 casos dominio/auth e 12 novos casos de navegador
desktop/mobile passaram. Layout inspecionado em 320 px e desktop, inclusive
foco de teclado. Fixtures loopback 4315/4316 e SDK interceptado apenas nos
testes; nenhum token Cloudflare real validado.

Codigo a1376975deab2d7e456d6d664b47f53d5ffa175a aprovado no
[CI da feature](https://github.com/gabbswq/millennium/actions/runs/37171747778):
57 dominio/auth, 36 SQL nativos por versao (17/18, zero SKIP), 12 navegador
anteriores e 12 CAPTCHA. Sao 117 casos unicos; nao somar repeticoes da matriz
ou PGlite (30 aprovados, seis SKIP explicitos). Lint, tipos via build e auditoria
omit=dev passaram; zero alertas conhecidos em dependencias de producao nao
certifica ferramentas dev ou seguranca absoluta. Pix/executor passaram no
codigo anterior 1ef5b5f9; ajuste seguinte mudou somente os testes CAPTCHA.
Integrar apenas develop, conforme governanca; nao promover preview/main.

Enforcement precisa ser ativado separadamente no Supabase; guard de cliente
nao protege API direta. Nenhum CAPTCHA/limite remoto foi configurado, nem
servico pago provisionado. Migrations cloud, patch PostgreSQL, dominio/host,
WAF e ensaio externo Auth/Stripe seguem como gates. Main preservada; meta
completa somente com esses resultados verificados e autorizados.

## Recuperacao de Checkout, 3 de outubro

Feature checkout-recovery parte de develop a4caa5cc. Comando operacional
payments:recover-checkout inspeciona um pedido/sessao por padrao, sem endpoint
publico ou POST Stripe. --bind-open e explicito, somente para sessao aberta
test-only conferida contra dono, UUID, metadata, preco/valor BRL e quantidade.
PATCH usa compare-and-set de estado/timestamp e nunca marca paid. SDKs tem
timeout de 10s e retries desativados; saida sem URLs/PII/credenciais.
[Runbook](CHECKOUT_RECOVERY.md). Nenhuma dependencia, migration ou UI nova.

Codigo 0c95c3fc0e89bc22d0f8e1f5768bce65af9f7ea1 aprovado no
[CI da feature](https://github.com/gabbswq/millennium/actions/runs/37169220199):
51 dominio/auth, 36 SQL nativos por versao (17/18, zero SKIP) e 12 navegador.
Sao 99 casos unicos, nao somar repeticoes da matriz. Inclui seis ensaios
multiconexao e perda de resposta apos PATCH ja commitado. Lint, tipos, build
e auditoria omit=dev passaram; esta ultima retornou zero alertas conhecidos,
mas nao certifica ferramentas dev nem toda a seguranca do produto. Pix e
executor tambem passaram no CI da mesma branch. Local PGlite: 30/36, seis
SKIP nativos explicitos; CLI real --help/input invalido sem credenciais testada.

Nao executar na nuvem sem autorizacao de operacao. Nenhuma credencial lida,
.env editado ou escrita externa realizada neste incremento. Sessao terminal
sem vinculo exige revisao/fluxo transacional separado, nao inventar URL ou
marcar paid manualmente. Connect permanece separado. Supabase primario ainda
aguarda autorizacao de migrations e atualizacao PostgreSQL; hospedagem/WAF,
login JWT real e Checkout/webhooks externos nao foram homologados.

## Projeto Supabase identificado, 3 de outubro

Gabriel indicou https://pywotovmlxzwwpawpaew.supabase.co. Conexao autorizada
confirmou organizacao gabbswq no Free, projeto ACTIVE_HEALTHY em Sao Paulo,
public/millennium_payments sem tabelas ou funcoes, auth.users com 0 usuarios,
Storage com 0 buckets e historico de migrations vazio. Consultas READ ONLY,
sem dados pessoais, credenciais ou alteracoes externas.

Advisor confirmou vulnerable_postgres_version: PostgreSQL 17.4 tem patches
pendentes. Atualizacao e gate antes de pagamentos publicos; nao foi executada.
[Preflight, evidencia e proximos gates](SUPABASE_PROJECT_PREFLIGHT.md).
Plano Free nao significa imunidade a abuso ou disponibilidade garantida.

Aplicacao das dez migrations no projeto primario aguarda resposta humana
explicita; envio da URL nao foi tratado como autorizacao de DDL. Verificar
preservacao dos timestamps no historico antes de aplicar. Host HTTPS/runtime,
JWT real, callbacks e Stripe externo ainda nao configurados. Nao editar .env,
nao provisionar adicionais pagos e nao usar testes destrutivos no Supabase.

Hardening anterior ja integrado em develop 904161771f201f6704117f0edf42951285affa65.
[CI Checkout/Connect/SQL integrado](https://github.com/gabbswq/millennium/actions/runs/37167284382)
passou, incluindo PostgreSQL 17/18 com 33/33 e zero SKIP. Main preservada em
3516b043c1be906e6d7c2631d7de9be74cf628cb; preview e release nao solicitadas.

## Banco e autenticacao: hardening incremental, 3 de outubro

Feature payments-database-hardening parte de develop 0282a18, nao de main.
Nova migration append-only 20261003000002_auth_access_hardening.sql corrige
recursao 42P17 de users, restringe grants/colunas e jobs caros, mantem catalogo
ativo legivel e fecha escrita de vinculo OAuth pelo browser. Rota sync-provider
usa somente identidade retornada pelo Supabase getUser(token), nunca metadata
editavel; cliente envia apenas provider. Nao ha aprovacao local de KYC.

Local: 35 testes dominio/auth, 28 SQL com todas as 10 migrations, 12 navegador
desktop/mobile passaram. Os 5 ensaios multiconexao ficam SKIP no PGlite, mas
executaram no CI PostgreSQL 17 e 18: 33/33 por versao, zero SKIP. Sao 80 casos
unicos de pagamentos, nao somar repeticoes da matriz. Lint, tipos, build e
browser CI passaram no codigo 9ef2c465.
[CI da feature](https://github.com/gabbswq/millennium/actions/runs/37155561152).
Driver pg fica somente em devDependencies. Banco real ainda nao aplicado.
Audit de producao sem alertas conhecidos; audit completo continua com alertas
dev. Nao afirmar teto de custo ou protecao absoluta a partir destes testes.

Perfis/authors permanecem privados sob RLS, nao um diretorio publico. Revisar
dono das funcoes e grants efetivos no projeto Supabase escolhido antes de
migrar. Projeto/plano/host/teto financeiro ainda faltam. Nao ler chaves ou
alterar .env; nao implantar Edge Functions legadas no novo Checkout.

Proximos gates: integrar somente develop; reconciliacao segura de
reservas UNCERTAIN e teste externo de login/Stripe/WAF/limites no projeto
autorizado. Preview/main exigem handoff/release conforme AGENTS. A meta nao
esta completa enquanto identidade real e fluxo financeiro externo faltarem.

## Checkout principal e menu Vendedores, 3 de outubro

Gabriel confirmou Checkout e depois pediu explicitamente preservar Connect para
vendedores em um menu separado. Nao remover esta frente. A feature atual
stripe-auth-kyc implementa login, email confirmado, menus separados, Checkout
de pagamento unico BRL, cadastro Connect hospedado e consulta de requirements.
KYC nao bloqueia compradores por falta de cadastro vendedor. Repasses/comissoes
nao foram implementados. Portfolio, landing e Pix ficam separados.

Contrato e limites: [STRIPE_AUTH_KYC_SPEC.md](STRIPE_AUTH_KYC_SPEC.md).
Setup e gates: [STRIPE_CHECKOUT_SETUP.md](STRIPE_CHECKOUT_SETUP.md).
Migrations novas nao aplicadas na nuvem. Supabase existe segundo Gabriel,
mas projeto/plano/Spend Cap/custo/host ainda precisam ser conferidos. Nenhuma
chave lida ou persistida; SDKs usam ambiente, Stripe live e recusada, features
desativadas por padrao. Codigo em main nao significara backend publicado.

Validacao local: 30 testes de dominio/SDK, 15 SQL efemeros e 10 de navegador
desktop/mobile com fixture Supabase separada e Stripe desativada. Lint, tipos,
build e auditoria de dependencias de producao verificados. Provedor real, JWT
real, concorrencia multiprocessos PostgreSQL, KYC e webhook externos continuam
pendentes. npm audit completo ainda tem alertas em ferramentas de desenvolvimento;
nao confundir auditoria omit=dev limpa com seguranca completa.

Corrigido conflito legado entre api/products/[id]/access e [slug], sem alterar
as URLs. Cliente Supabase SSR atualizado por incompatibilidade com o SDK;
tags de artigos passam por mapeamento tipado. Checkout novo nao usa as Edge
Functions legadas; nao implanta-las para este fluxo. Antes de banco externo,
revisar a cadeia antiga, especialmente policies recursivas de public.users.

Executor CLI: usar Ubuntu/WSL, conforme README. O ensaio nativo Windows teve
29/32 testes aprovados (aceite e symlink falharam); nao anunciar suporte Windows
completo nem refatorar o executor dentro desta feature de pagamentos.

As secoes seguintes sao historico. Nao inferir estado atual apenas delas.

## Direcao esclarecida: online, banco e futuro iOS

Em 3 de outubro, Gabriel explicou que deseja Millennium online, com login,
banco de dados, futuro app iOS e pagamentos reais apos testar com dinheiro
ficticio. Local e sandbox sao etapas, nao um destino permanente. O tunnel
proposto nao recebeu aprovacao; ele so seria uma ponte temporaria para ensaio
local. Backend HTTPS hospedado dispensa essa ponte. Conta/provedor de
hospedagem e teto de custo continuam pendentes de escolha humana.

A continuidade fica em [PAYMENTS_ONLINE_SPEC.md](PAYMENTS_ONLINE_SPEC.md).
`feature/payments-account-schema` prepara schema PostgreSQL isolado e testes
de identidade/RLS, centavos, idempotencia, eventos imutaveis e rollback. Nao
aplica em banco externo, nao instala servico PostgreSQL no computador e nao
conecta o painel JSON ao banco. O bootstrap de identidade e apenas fixture,
nao login real. Consulte [guia SQL](../payments-sandbox/database/README.md).

Proximo passo de codigo: repositorio transacional com escopo de conta, sem
reutilizar o estado global do laboratorio para usuarios online. Depois ligar
identidade real, hospedagem e homologacao Asaas completa. Main, preview,
landing e portfolio permanecem fora destes incrementos. A meta continua
pendente enquanto login, acesso pelo celular e pagamentos externos nao forem
comprovados.

## Continuidade: receptor de webhook isolado

O receptor opcional de `feature/pix-webhook-receiver` compartilha os registros
do modo Asaas e aceita somente POST `/webhooks/asaas` numa porta separada,
sem painel ou API de consulta. Ativacao exige `--asaas --webhook-port 4312`.
O listener do painel continua loopback, com Host e CSRF inalterados.

Consulte [WEBHOOK_SANDBOX.md](../payments-sandbox/WEBHOOK_SANDBOX.md) para o
roteiro e a matriz de aceite. Nenhuma URL HTTPS foi aberta, nenhum tunnel
instalado e nenhum webhook cadastrado em conta externa. Ainda faltam a conta
Sandbox escolhida por Gabriel, credenciais inseridas no terminal, exposicao
temporaria autorizada e eventos reais correlacionados com logs do provedor.

## Prioridade atualizada: Pix sandbox, 3 de outubro

Gabriel respondeu **Priorizar pagamentos em sandbox**. O painel web de agentes
foi adiado; o executor de turnos continua preservado. O laboratorio separado
em `payments-sandbox/` nasce na feature `feature/pix-sandbox`, para integrar
somente em develop. Main, preview, landing e portfolio nao fazem parte do
incremento. Nenhuma credencial, conversa privada ou dado de teste deve ir ao Git.

Comece por [guia Pix](../payments-sandbox/README.md) e
[SPEC Pix](PIX_SANDBOX_SPEC.md). As tarefas **Millennium Pix: instalar laboratorio**
e **Millennium Pix: iniciar simulador** permitem testar pelo VS Code/WSL.
O QR do simulador nao e pagavel; o adaptador Asaas nao usa producao.

Ainda falta a conta de testes escolhida por Gabriel, a homologacao real Asaas
e o transporte HTTPS restrito ao webhook. O listener do painel aceita apenas Host local:
nao expor um tunnel nem relaxar a protecao de origem para "fazer funcionar".
Uma suite com fixtures nao prova que o provedor entregou um evento real.
Gabriel ainda deve percorrer o fluxo e explicar uma entrada, estado e teste.

O texto abaixo registra o incremento anterior, nao a prioridade atual.

## Continuidade em 3 de outubro de 2026

O foco escolhido foi o executor local do turno, não o gateway. A implementação
em `feature/turno-local`, destinada apenas a `develop`, fica em
`C:\Users\gabbs\Documents\ChatGPT\M\millennium` (WSL:
`/mnt/c/Users/gabbs/Documents/ChatGPT/M/millennium`). O checkout pessoal
`~/ai-projects/gabbs-product-factory` permanece separado, com suas alterações
anteriores preservadas. Não troque/reset essa pasta para pegar o incremento.

Comece por [TURNO_LOCAL.md](TURNO_LOCAL.md) e **Millennium: diagnostico do turno**
no VS Code conectado ao WSL. O executor descobre Codex no PATH ou em
`~/.local/bin`; isso corrige a entrada ausente em terminais não-login.

Os primeiros ensaios passaram, mas suas pastas em `/tmp` já não estão
disponíveis; não dependemos delas como evidência atual. O novo ensaio real em
`.millennium/live-tOAFD7/` completou plano, implementação, cinco testes de
validação de anomalia fictícia, revisão somente leitura e fechamento. Os
registros persistem dentro desta cópia privada, fora do Git. Não gerou aceite
humano: `accepted_evidence` permanece nulo e a tarefa fica em revisão.

A suite automatizada passou com 32 testes, sem inferência. Cobre branch,
locks, cancelamento (inclusive filho resistente ao SIGTERM), recuperação,
evidências e aceite. O diagnóstico real encontrou Node 20.20.2 e Codex CLI
0.158.0 autenticado no Ubuntu. Uma revisão independente do executor não
encontrou achados bloqueadores, mas não rodou a suite em seu sandbox somente
leitura; a execução dos testes foi feita separadamente.

Este é um incremento técnico, não usabilidade aprovada. Próxima sessão:
Gabriel abrir a develop isolada no VS Code, preparar uma feature, executar uma
tarefa pequena e explicar uma mudança/teste. Registrar dificuldades reais
antes de adicionar chat web, banco, mais agentes ou pagamentos.

QA em preview, tags e produção em main não foram solicitados neste turno.
O conteúdo abaixo preserva o histórico e as referências da transição anterior.

## Objetivo e decisão

Gabriel confirmou **Millennium** como marca. O produto é uma fábrica pessoal de software assistida por IA, com turnos, execução, revisão, aprendizado e passagem de serviço. A experiência futura usa conversa e prévia como referências; a aplicação de pagamentos é uma iniciativa posterior, separada.

## O que foi preparado

- SPEC com requisitos, contrato de execução, arquitetura proposta e critérios de aceite.
- Primeiro turno no VS Code e alinhamento de brief, roadmap e guias.
- Nome Millennium na landing local, metadados do experimento, títulos de workspaces e extensão privada 0.1.3.
- Iniciador local `C:\dev\Abrir Millennium.cmd` e guia `C:\dev\fabrica\COMECE-AQUI.md`.
- Backups dos arquivos anteriores, sem descarte de alterações existentes.
- Publicação autorizada em [gabbswq/millennium](https://github.com/gabbswq/millennium) e [landing Millennium](https://gabbswq.github.io/millennium/).

## Publicação verificada

O commit `c4e78546bc1d53c44066d3cca65d117d6235b7ed` publicou a direção e a marca. O [workflow de qualidade e deploy](https://github.com/gabbswq/millennium/actions/runs/36852399589) concluiu com sucesso. A página pública foi aberta em 1440, 390 e 320 pixels, com título Millennium, links para o novo repositório, assets carregados e sem erros de JavaScript ou overflow horizontal detectado.

O estado remoto anterior está preservado na branch `backup/pre-millennium-20261001`, no commit `8d16366b1c95c7f41ecc0e43a5340cae09c41338`. Os arquivos de código de segurança, webhook e alterações de dependências que já estavam em andamento não entraram na publicação. O endereço público antigo da landing não deve ser usado como entrada atual.

## Evidências técnicas desta transição

- `npm --prefix landing run verify`: build, 14 testes Playwright e limite de bundle passaram.
- `node --test /mnt/c/dev/fabrica/vscode-extension/tests/*.test.cjs`: 10 testes passaram.
- `C:\dev\fabrica\tests\Test-Setup.ps1`: quatro workspaces e 24 combinações de papel/modo verificadas sem iniciar IA.
- `npm run typecheck`: passou na aplicação experimental.
- Capturas locais em 1440, 360 e 320 pixels, sem overflow horizontal detectado.
- Extensão 0.1.3 confirmada no VS Code Windows e no servidor WSL; isso não comprova que uma janela antiga foi recarregada.

Os registros e backups desta transição ficam no diretório local `millennium-transition` do chat de trabalho. Eles não devem ser publicados integralmente como documentação do produto.

## Pendências registradas em 1 de outubro

- Uma sessão em que Gabriel execute, confira e retome uma tarefa sozinho.
- Interface própria de conversa e prévia, executor persistente e coordenação automática.
- Medição comparativa de tokens/custo e acesso pelo celular.
- Operação real de pagamentos.

Não considerar o projeto inteiro pronto com base nos testes acima.

## Preservar ao continuar

O checkout principal já tinha alterações em README, `index.html`, workflows, dependências, webhook e uma SPEC de segurança. A cópia de trabalho em `C:\dev\fabrica\web` também tem alterações próprias. Não publicar tudo junto, sobrescrever uma pela outra, resetar ou mover pastas sem verificar as referências.

Os caminhos `gabbs-product-factory` e `C:\dev\fabrica` e os IDs internos `fabrica.*` permanecem por compatibilidade. O nome exibido é Millennium. Snapshots históricos não devem ser usados como roteiro atual.

## Próxima ação da transição de 1 de outubro

Abrir `Abrir Millennium.cmd`, conferir o título Millennium/lead e o contexto Ubuntu, e seguir [PRIMEIRO_TURNO.md](PRIMEIRO_TURNO.md) com Gabriel. Começar por uma proposta pequena do exercício Diário de Turno, com dados fictícios; não construir o aplicativo inteiro antes de observar o primeiro uso.

Durante a sessão, ensinar a diferença entre arquivo, alteração (diff) e commit. Pedir que Gabriel encontre um arquivo alterado e explique uma mudança. Registrar aqui o resultado real e a próxima ação, sem marcar os critérios de usabilidade como aprovados antecipadamente.
