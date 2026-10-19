# Passagem de turno: Millennium

Registro de 1 de outubro de 2026. Revalidar antes de continuar.

## Conta Stripe e hospedagem de teste, 6 de outubro

Meta continua integral: login/Supabase/Checkout TEST na Vercel com controles
de abuso/custo, sem plano pago ou pagamentos reais. Gabriel confirmou que
ainda precisa configurar a conta Stripe; registro, login e MFA sao humanos.
Nao interpretar testes locais como homologacao externa nem pedir segredos.

Projeto millennium-test criado pela conexao nativa Vercel. Deploy da revisao
009d43a0 terminou READY mas retornou target=production apesar de pedido Preview;
cancelamento falhou e projeto foi pausado. Duas consultas HTTPS anonimas em
6 de outubro comprovaram 503 DEPLOYMENT_PAUSED no URL unico e dominio principal.
Sem bypass, credencial, plano pago ou alteracao main/preview. Proximo deploy
devera omitir target conforme API oficial e confirmar target=null/protecao
antes de homologar. Tentativa corrigida criou o registro
dpl_BBv3K67pN7k1XMAUHW2u4dsC5DWE com target=null e codigo 195aecfe, mas
estado BLOCKED. O conector retornou isError=true; consulta posterior encontrou
esse registro. Nao repetir a criacao nem considerar homologacao concluida.
O conector nao retornou causa; o painel oficial autenticado confirmou que
o projeto pausado impediu a construcao. Consulta anonima do Preview retornou
302 para vercel.com, sem bypass; isso prova protecao, nao aplicativo funcional.
[Estado e gates](VERCEL_HOMOLOGATION.md).

Feature stripe-test-key-policy usa uma policy comum para sk_test_/rk_test_ no
app e recuperacao; recusa live/publicavel/organizacional/malformada antes dos
SDKs. Zero retries, timeouts, flags, correlacao e livemode preservados.
Nao cria chave nem garante permissoes remotas; [inventario e guia](STRIPE_TEST_KEYS.md).
Local: 74 testes dominio/Auth aprovados, incluindo sete casos novos; lint,
typecheck e build aprovados. CI final do codigo/lockfile 195aecfe aprovado:
[pagamentos](https://github.com/gabbswq/millennium/actions/runs/37412445072)
e [seguranca](https://github.com/gabbswq/millennium/actions/runs/37412445011).
138 casos unicos de pagamentos: 74 dominio/Auth, 40 SQL nativos (17/18),
12 browser e 12 CAPTCHA. PGlite passou 34/40 e SKIP explicito nos seis casos
multiconexao; nao somar matrizes ou repeticoes. Auditoria producao zero alertas
conhecidos. CodeQL analise 1898104184 da mesma revisao: zero resultados,
error/warning vazios; API da ref da feature/state=open retornou zero.
Integracao somente develop; nenhuma release main/preview ou pagamento.

Primeiro CI da feature 29203881 falhou na auditoria de producao por
source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q, high). Demais etapas de verify
ficaram SKIP; nao considerar esse CI aprovado. SQL 17/18 e CodeQL/regressoes
concluiram separadamente. Lockfiles raiz/landing recebem somente a versao
1.2.2, URL e integridade oficiais; sem audit fix amplo, dependencia nova ou
relaxamento do gate. CI do lockfile corrigido acima passou. Build/checker da
landing Windows passaram com permissao revisada apos restricao de caminho do
sandbox, warning Tailwind existente e gzip JS 46061/153600 bytes. Auditoria
completa atual tem 10 entradas dev/transitivas (7 high/3 moderate); nao limpa.
Essa triagem nao autoriza downgrade Next/ESLint ou migracao Tailwind major.

Vercel aceitou STRIPE_CHECKOUT_ENABLED=false e STRIPE_CONNECT_ENABLED=false
para preview/production e readback de Node 22.x, mantendo SSO padrao.
Configuracao de build, fonte privada, sem autoassign e duracao de 30s/gru1
foi solicitada. Painel oficial confirmou Hobby, Node 22.x, gru1, timeout padrao
30s, protecao Standard e builds concorrentes sob demanda desativados. Fonte
privada, autoassign e comandos ainda nao foram conferidos no painel.
Nenhuma alteracao de UI, upgrade ou desbloqueio foi executado nessa leitura.
O limite de duracao nao e um teto financeiro nem prova runtime.

Integracao publicada em develop bfa763dfb0b8b8a020eb83a698ed81018fa1a2c8,
com paridade de codigo/lockfiles conferida contra 195aecfe. [CI integrado](https://github.com/gabbswq/millennium/actions/runs/37413359655)
e [CodeQL integrado](https://github.com/gabbswq/millennium/actions/runs/37413359682)
aprovados. Analise 1898143068 do SHA integrado: zero resultados/error/warning;
consulta explicita ref develop/state=open retornou zero. Main remoto permanece
3516b043c1be906e6d7c2631d7de9be74cf628cb e preview ausente. Nao houve
release, habilitacao financeira ou homologacao Auth/Stripe real.

## Tres alertas restantes corrigidos na feature, 5 de outubro

Feature security-static-regressions parte de develop 6055fb6d. Busca renderiza
texto/DOM seguro, fixture de descendente usa arquivo/argv e medicao de bundle
usa um unico buffer. Antes: dois cenarios de markup falharam em ambos os
viewports e metadado stat sintetico divergiu dos bytes lidos. Nenhuma mudanca
de artigos, layout, credenciais, migrations, planos ou pagamentos.

Local: dez testes de busca desktop/mobile (Chrome existente), quatro Node de
bundle Windows/Ubuntu, 45 executor Ubuntu e caso de encerramento forcado com
caminho literal aprovados. Capturas inspecionadas. Build/checker landing passam
(gzip JS 46061 de 153600 bytes). Codigo dd3795cf aprovado no
[CI seguranca](https://github.com/gabbswq/millennium/actions/runs/37305524147)
e [executor](https://github.com/gabbswq/millennium/actions/runs/37305524100):
59 casos unicos. CodeQL analise 1892950884: zero resultados, sem error/warning;
consulta explicita da ref da feature/state=open retornou vazio. Sem supressao.
Integrado em develop 009d43a0. [CI seguranca integrado](https://github.com/gabbswq/millennium/actions/runs/37306091601)
e [executor integrado](https://github.com/gabbswq/millennium/actions/runs/37306091587)
aprovados. Logs de regressao recuperados em 6 de outubro: quatro bundle,
dez browser, zero SKIP e gzip 46061/153600. Analise 1892972549: zero resultados;
consulta API explicita da ref develop confirma IDs 1-11 fixed. 59 casos unicos.
[Evidencia, limites e roteiro](SECURITY_STATIC_REGRESSIONS.md). Nao inferir
seguranca completa ou homologacao com esse resultado. Meta ativa; conta Stripe,
configuracao segura e gates externos pendentes. Historico posterior de Vercel
esta no checkpoint de 6 de outubro; main/preview permanecem preservadas.

## Limites Fastify integrados, 5 de outubro

Feature security-ingress-limit parte de develop 4ad7f655. Orcamentos por
listener (120/60s) e mutacoes (20/60s), antes de corpo/handlers e inclusive
404; sem confiar em headers/IP do cliente. Receptor independente e ainda
privado. Plugin oficial fixado; snapshot do store corrige recusa excessiva
em rajada concorrente sem reimplementar janela/cache. Nenhuma credencial,
migration, UI, plano ou chamada externa de pagamentos.

Local: 51 API/provedor/receptor Ubuntu e 12 regressoes Windows, zero SKIP;
TCP real bloqueia antes do corpo. Build aprovado e audit producao local zero
alertas conhecidos. Navegador Windows ausente; download oficial terminou
em timeout, nao equivale a fluxos locais aprovados. Codigo 56a4f964 aprovado
no [CI](https://github.com/gabbswq/millennium/actions/runs/37302691893): 127 casos
unicos, incluindo os 12 fluxos de navegador e SQL 17/18. [CodeQL](https://github.com/gabbswq/millennium/actions/runs/37302691853)
da ref da feature mostra tres open (IDs 1, 2, 5; 2 high/1 medium), sem supressao.
Integracao publicada em develop 0dc9e9ca255ce3c1fed9ec5df9acb49ceebc84f6.
[CI integrado](https://github.com/gabbswq/millennium/actions/runs/37303081987) e
[CodeQL integrado](https://github.com/gabbswq/millennium/actions/runs/37303082108)
aprovados, 127 casos unicos. API da ref develop: IDs 3/4 fixed, IDs 1/2/5
open (2 high/1 medium), sem supressao; [evidencia e limites](SECURITY_INGRESS_LIMITS.md).
Vercel aguarda login humano, meta continua ativa e main/preview intactas.

## Estado integrado verificado, 5 de outubro

Develop publicado em 4e4f9c372211b1d8d4deabfeb7b8e2b34c3d8354, incluindo
hardening de arquivos e guia de login Vercel. [CI Pix integrado](https://github.com/gabbswq/millennium/actions/runs/37300227137),
[executor integrado](https://github.com/gabbswq/millennium/actions/runs/37300227082)
e [CodeQL integrado](https://github.com/gabbswq/millennium/actions/runs/37300227225)
aprovados. Logs: 45 executor/arquivos, 39 API/receptor, 19 SQL e 12 navegador;
115 casos unicos, sem somar repeticoes da matriz SQL 17/18 ou workflows.

API CodeQL consultada com ref=refs/heads/develop: IDs 6-11 fixed; IDs 1-5
open (4 high, 1 medium), sem supressao/exclusao ou fechamento manual. Isso
nao certifica seguranca completa. Main remoto continua 3516b043c1be906e6d7c2631d7de9be74cf628cb;
preview ausente. Nenhuma release, deploy ou pagamento real.

Gabriel confirmou que ainda nao autenticou o CLI Vercel. Proximo passo humano:
login oficial pelo procedimento em [VERCEL_HOMOLOGATION.md](VERCEL_HOMOLOGATION.md),
sem enviar senha, codigo ou token aqui. Meta permanece ativa; cinco alertas,
dependencias dev e gates externos continuam pendentes. Os checkpoints locais
abaixo sao historico, substituidos pela evidencia integrada desta secao.

## Hardening de arquivos locais, 5 de outubro

Feature security-file-descriptors parte de develop 34354a02. Quatro falhas
reproduzidas antes da correcao (Store/Pix/fingerprint seguindo symlink trocado,
fallback sobrescrevendo resposta concorrente). Leitor compartilhado por FD,
flags POSIX e identidade/tipo antes dos bytes; fallback exclusivo wx e falha
registrada sem repetir provedor/alterar alvo externo. Nenhuma dependencia,
migration, credencial, UI ou operacao cloud alterada.

Ubuntu local: 44 executor/arquivos (12 novos) e 39 Pix, zero SKIP. Windows
leitor: 6/7, um SKIP symlink; Pix 38/39, EPERM em fixture de symlink antiga.
Sem esconder falha ou elevar privilegios. Codigo db4ef4cd passou no
[CI Pix](https://github.com/gabbswq/millennium/actions/runs/37263656254) e
[CI executor](https://github.com/gabbswq/millennium/actions/runs/37263656249):
44 executor, 39 API, 19 SQL por versao 17/18 e 12 navegador, build aprovado.
114 casos unicos, sem contar repeticoes de matriz/workflow. CodeQL na ref da
feature passou de 11 para 5 abertos; IDs 6-11 ausentes, sem supressao/exclusao.
Integrar so develop; [evidencia e limites](SECURITY_FILE_HARDENING.md).

Revisao final reproduziu perda de precisao de inode acima de 2^53. Leitor usa
Stats BigInt; teste novo aprovado. Local final: 45 executor Ubuntu, zero SKIP;
leitor Windows 7/8, um SKIP. Codigo final b49752ee aprovado no
[CI Pix](https://github.com/gabbswq/millennium/actions/runs/37298747278),
[executor](https://github.com/gabbswq/millennium/actions/runs/37298747252) e
[CodeQL](https://github.com/gabbswq/millennium/actions/runs/37298747287):
115 casos unicos; API confirma cinco alertas abertos na ref da feature.
Integracao anterior esta somente local em develop, ainda nao publicada;
integrar ajuste final somente em develop. Gabriel confirmou que ainda nao
autenticou CLI Vercel e perguntou sobre limpar/meta/SPEC. Orientacao fornecida;
novo foco nao confirmado, escopo de produto preservado. Hospedagem aguarda login
humano, sem envio de tokens/codigos ao chat.

Checkpoint: codigo b49752ee integrado localmente em develop sem conflitos.
Publicacao e checks do merge pendentes de confirmacao remota. Manter main
intacta e preservar a documentacao de login da feature vercel-homologation.
Nao atribuir a isso protecao de DDoS, isolamento de processo hostil ou teto
financeiro. Preflight documental Vercel integrado; runtime aguarda login humano.

## Homologacao Vercel escolhida, 5 de outubro

Incremento de seguranca integrado em develop 34354a028c29d0baeb4c07d7bd4e3c36c05820fb.
[CI integrado](https://github.com/gabbswq/millennium/actions/runs/37261387963)
e [CodeQL integrado](https://github.com/gabbswq/millennium/actions/runs/37261387945)
aprovados; mesmos 11 alertas abertos confirmados por API na ref develop.
Main remoto segue 3516b043c1be906e6d7c2631d7de9be74cf628cb, preview ausente.

Gabriel escolheu Vercel, sem plano pago. Conexao do app confirmou gabbswq/hobby,
nenhum team e nenhum projeto na busca millennium. CLI 62.2.0 em cache local,
sem instalacao global/dependencia, whoami Logged out. Nao extrair token do app
nem publicar main usando helper Git. Precisa login humano do CLI; procedimento
e gates em [VERCEL_HOMOLOGATION.md](VERCEL_HOMOLOGATION.md). Nenhum deploy,
.env, secret, trial/add-on ou recurso pago criado. Feature vercel-homologation
registra preflight; sem QA humana ou ensaio Auth/Stripe real ainda.

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

Checkpoint 5 de outubro: feature integrada localmente em develop sem conflitos.
Publicacao/checks do merge devem ser confirmados antes de afirmar conclusao
remota. Nenhum alerta foi fechado automaticamente pela integracao.

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

## Checkpoint de Checkout TEST, 15 de outubro

Gabriel retomou a meta integral: login/Supabase/Stripe Checkout de teste na Vercel,
sem plano pago nem pagamento real. Não pedir que remova instruções personalizadas;
elas não explicam os bloqueios de configuração abaixo.

### Estado remoto confirmado

- Supabase `pywotovmlxzwwpawpaew` estava INACTIVE; a restauração pelo conector foi
  aceita. `get_project` confirmou `ACTIVE_HEALTHY`, região sa-east-1, organização
  no plano Free. Nenhum upgrade de plano foi feito.
- `list_migrations` confirmou as 12 migrations esperadas. `list_tables` confirmou
  as tabelas públicas com RLS ativo.
- O produto e preço TEST que Gabriel criou na Stripe foram sincronizados no
  catálogo remoto como compra única, ativa, R$ 1,00 BRL. IDs locais:
  produto `8399e814-c1fe-4398-bf67-3664005fdac7`, preço
  `7992212f-49a5-4c05-b94c-4b00c02768da`. Stripe product/price IDs vieram de
  Gabriel. Nenhuma sessão, cobrança ou transação foi criada.
- Advisor de segurança continua com alertas intencionais de tabelas server-only
  sem policy, visibilidade de schema GraphQL, helpers SECURITY DEFINER e patches
  pendentes do Postgres 17.4.1.075. Não conceder policies amplas nem atualizar
  Postgres sem plano de recuperação e autorização.
- Vercel `millennium-test`, projeto `prj_mFFhIx2CM3D4ErZzmcNlpKjBLCxv`, é
  acessível para metadata sem teamId. O deployment mais recente é READY, alvo
  production, commit `009d43a086d58c01c54a230618d0b99eaa6efa54`; não foi criado
  deployment novo. SSO protege os deployments e `web_fetch_vercel_url` retornou
  403 no passo de bypass. Não tentar contornar a negação por outra via.
- Metadata de env com decrypt=false mostrou somente `NEXT_PUBLIC_SUPABASE_URL`
  (Preview) e `STRIPE_CHECKOUT_ENABLED=false` / `STRIPE_CONNECT_ENABLED=false`
  (Preview e Production). Faltam NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_CHECKOUT_WEBHOOK_SECRET e
  MILLENNIUM_APP_ORIGIN. Não ler/descriptografar segredos nem alterar credenciais;
  as flags continuam desligadas. A chave Stripe restrita sem permissões fica como
  está por decisão de Gabriel e não foi utilizada.

### Validação local deste checkpoint

- `npm run test:payments`: 74 aprovados, zero falhas.
- `npm run test:payments:sql`: 34 aprovados, zero falhas, seis SKIP explícitos
  por testes concorrentes que exigem PostgreSQL nativo.
- `npm run typecheck` e `npm run lint`: passaram.
- `npm run build` no WSL/Linux: passou e gerou as rotas de login, Checkout e
  webhooks. WSL usa Node 20.20.2 e emitiu aviso de que supabase-js requer Node 22
  nas próximas versões; Vercel está configurada em Node 22.x.
- O build no Windows falhou resolvendo imports da página de artigos, embora os
  mesmos arquivos existam; build Linux passou. O servidor de desenvolvimento
  Windows tentou instalar tipos automaticamente e não chegou a servir a rota;
  processo foi encerrado. Worktree continuou limpo antes deste registro.
- No WSL, `npm run dev -- --hostname 127.0.0.1 --port 4313` ficou pronto e as
  rotas `/auth/login` e `/auth/signup` responderam HTTP 200; os formulários foram
  inspecionados no navegador. Nenhum dado foi enviado e nenhuma conta foi criada.
  O servidor desta sessão continua rodando em http://127.0.0.1:4313/auth/login;
  URL/chave anon foram variáveis do processo, não arquivo.
- Nenhum teste de login JWT real, email, CAPTCHA, Checkout Stripe ou webhook
  foi completado. Typecheck/build e suites locais não comprovam runtime externo.

### Branch e próxima ação

Worktree `C:\Users\gabbs\Documents\ChatGPT\M\millennium` sincronizou develop
sem fast-forward e abriu `feature/stripe-supabase-test-homologation`. Ainda sem
alteração de código, commit, push, merge ou deploy. Siga AGENTS.md, que proíbe
publicação/deploy pelo executor.

Para destravar o teste web, Gabriel precisa autorizar a conexão Vercel ao time/
deployment Millennium, adicionar as chaves necessárias somente nos campos
seguros do Preview e configurar Supabase Auth URL/callbacks. Chave restrita da
Stripe deve ter apenas Prices read e Checkout Sessions write, com dependências
mínimas. Depois, verificar metadata sem descriptografar, ativar Checkout TEST
somente após revisão, e testar login, sessão Checkout e webhook assinado. Não
habilitar Connect nem pagamentos reais. Não repetir testes aprovados sem alteração.

## Checkpoint de autenticacao local, 15 de outubro

Escopo priorizado pelo usuario: entregar uma tela de login e preparar Google
OAuth local; Vercel, Stripe e pagamentos ficam para fase posterior. Nenhum
deploy, push, commit, mudanca remota ou acesso financeiro foi feito.

### Estado do codigo

- Branch confirmada: `feature/stripe-supabase-test-homologation`.
- `/auth/login` foi redesenhada com identidade Millennium, layout responsivo,
  email/senha, mostrar/ocultar senha, CAPTCHA existente, links de cadastro e
  recuperacao, erros legiveis e estado sem configuracao Supabase.
- OAuth Google usa `/auth/callback`, troca de codigo pela sessao Supabase e um
  destino `next` validado para aceitar apenas caminho interno. Ha teste unitario
  para destinos externos e entradas invalidas.
- Instrucoes estao em `AUTH_GOOGLE_SETUP.md`; criterios e limites em
  `SPEC_AUTHENTICATION.md`.
- `next-env.d.ts` agora referencia `.next-e2e/types/routes.d.ts` e `tsconfig.json`
  foi reformatado/ampliado para incluir tipos de `.next-e2e`. Esses diffs foram
  encontrados no checkout e preservados, sem atribui-los como necessarios para
  a implementacao de autenticacao.

### Evidencia desta retomada

- `npm run test:payments` no Windows: 77 aprovados, zero falhas, incluindo os
  testes de redirecionamento OAuth.
- `npm run typecheck` no WSL: concluiu com exit code 0.
- Branch e `git status` foram consultados pelo WSL. A tentativa de `git diff
  --check` no PowerShell nao foi valida porque `.git` e uma referencia WSL.
- `npm run build` no Windows falhou com `EPERM` ao criar
  `.next/types/app/api`. Nenhum cache foi apagado. A tentativa de testes no WSL
  nao serve como evidencia: `node_modules` contem esbuild Windows e o runtime
  Linux exige o binario Linux.
- `npm run test:payments:e2e` ficou sem iniciar os casos por mais de dois minutos,
  exibindo apenas avisos `NO_COLOR`/`FORCE_COLOR`; o processo foi interrompido.
  O endpoint `127.0.0.1:4313` nao estava acessivel nesta sessao. Desktop e mobile
  nao estao validados por E2E nesta retomada.
- Um `npm run lint` anterior desta implementacao havia passado. Nova tentativa
  ficou sem saida por mais de 90 segundos e foi interrompida; nao declarar um
  resultado novo de lint com base nela.
- O fluxo Google real segue sem validacao, pois depende de criar/configurar OAuth
  Client no Google Cloud e habilitar o provedor/callback no Supabase. Nunca enviar
  segredo pela conversa nem inserir segredo no codigo.

### Proximas acoes

1. Resolver o ambiente de build/teste Windows sem apagar `.next` ou modificar
   dependencias indiscriminadamente; verificar ACL e processos antes de agir.
2. Reexecutar lint, Playwright desktop/mobile e build, guardando exit codes e
   evidencias; testar a pagina renderizada quando o loopback estiver disponivel.
3. Orientar Gabriel, em passos curtos, a configurar Google OAuth no Google Cloud
   e Supabase; depois testar consentimento, callback PKCE, sessao, logout e novo
   login com conta de teste.
4. Manter a meta ativa ate os testes automatizados e a validacao humana de login
   por email/Google estarem comprovados. Checkout e pagamentos ficam fora desta
   fase.

### Revalidacao apos permissao local, 17 de outubro

Este registro atualiza os resultados de build e Playwright acima:

- Playwright foi executado no Windows com as fixtures locais em loopback, depois
  de instalar o Chromium/Headless Shell correspondente ao Playwright 1.63.0.
  `npm run test:payments:e2e`: 12/12 aprovados, incluindo seis casos desktop e
  seis mobile. Os casos da UI verificam Google, links, mostrar/ocultar senha,
  dimensao responsiva e carregamento da marca. As capturas
  `test-results/login-auth-redesign-desktop.png` e `...-mobile.png` foram
  inspecionadas. A autenticacao exercitada usa fixture local, nao credenciais
  nem servico real do Supabase.
- `npm run lint`: exit code 0.
- `npm run build`: exit code 0; compilacao, verificacao de tipos e geracao de
  20 paginas estaticas concluidas. O build documentado acima em seguida falhou
  com EPERM foi uma tentativa sem permissao elevada; a execucao posterior
  autorizada concluiu. `.next` e artefato gerado ignorado pelo Git.
- `npm run test:payments`: 77/77 aprovados; `npm run typecheck`: exit code 0 na
  validacao anterior desta retomada.
- O fixture local foi encerrado pelo Playwright. Nenhum servidor permanente
  ficou ativo ao fim da execucao.
- Login real por email e OAuth Google ainda nao foi validado. Configuracao de
  provedor/callback no painel Supabase e OAuth Client no Google Cloud continua
  necessaria para a etapa humana. O teste visual, fixtures e build nao provam
  autenticacao real.
- `npm run dev -- --hostname 127.0.0.1 --port 4313` esta ativo para revisao
  manual. A pagina abriu no navegador local, exibiu o aviso de Supabase nao
  conectado e manteve login/Google desabilitados. As variaveis publicas
  `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nao estao
  configuradas neste processo; nao foram lidas nem alteradas. O usuario pode
  inspecionar a pagina em `http://127.0.0.1:4313/auth/login`.

### Atualizacao final do fluxo OAuth, 17 de outubro

- O app agora consulta `GET /auth/v1/settings` antes de iniciar Google OAuth.
  Se o provedor estiver desligado, nao redireciona para a resposta JSON crua do
  Supabase; mostra erro legivel no formulario. Falha de rede/verificacao tambem
  interrompe o redirecionamento de forma explicita.
- O E2E recebeu fixture publica de configuracao com Google desligado e assert
  para permanencia na tela/erro. `npm run test:payments:e2e`: 14/14 passaram em
  desktop e mobile. `npm run test:payments`: 77/77 passaram; lint, typecheck e
  build de producao passaram depois desta alteracao.
- Consulta somente leitura do endpoint Auth do projeto retornou HTTP 200,
  `external.email=true` e `external.google=false`. Cliquei no botao Google com
  essa configuracao: o navegador permaneceu em `/auth/login` e mostrou a
  mensagem de provedor desativado. Nenhum email, senha, consentimento ou sessao
  de usuario foi enviado/testado. Portanto Google OAuth real ainda depende de
  configurar Client ID/Secret e ativar o provedor no painel; nao declare como
  integrado ate completar consentimento e callback.
- A documentacao agora inclui setup dos valores publicos no `.env.local`, que e
  ignorado pelo Git, e proibe `service_role`/chaves secretas em variaveis
  `NEXT_PUBLIC_*`. Para esta revisao, URL e chave `anon` publica ficaram apenas
  no ambiente efemero do processo local, sem arquivo; o dev server continua
  ativo em `http://127.0.0.1:4313/auth/login`.

### Checkpoint para nova meta, 18 de outubro

- O E2E foi ampliado com um caso de credenciais invalidas: a tela deve continuar
  em `/auth/login`, mostrar erro legivel e nao colocar email/senha na URL.
- O ultimo resultado Playwright em `test-results/.last-run.json` registra
  `status: passed` e nenhuma falha. A suite atual tem 16 casos desktop/mobile.
- `npm run typecheck` passou depois da inclusao desse caso. Os testes de unidade
  (77), lint e build ja tinham passado antes; nao houve mudanca de codigo de
  aplicacao desde esses resultados.
- O dev server local nao estava ativo na verificacao deste checkpoint. Nao ha
  `.env.local` presente; nao iniciar usando variaveis/segredos presumidos.
- Os E2E de login usam fixtures locais. Nenhuma credencial real foi submetida.
  O projeto Supabase consultado por HTTP indicou email habilitado e Google
  desabilitado; o preflight apresenta erro legivel. OAuth Google real continua
  pendente da configuracao manual do Client OAuth no Google Cloud e Supabase.
- Retomar com `AGENTS.md`, `git status` e diff no checkout/branch correto. O
  acesso WSL teve `Wsl/E_ACCESSDENIED` em uma tentativa recente; nao contornar
  essa restricao. Preservar alteracoes. Sem deploy, push, commit, pagamento,
  mudanca de credenciais ou plano.

### Revalidacao local, 19 de outubro

- `npm run test:payments`: 77/77 aprovados.
- `npm run typecheck`: exit code 0.
- `npm run lint`: exit code 0.
- `npm run test:payments:e2e`: 16/16 aprovados, oito casos desktop e oito
  mobile. Foi necessario permitir loopback para o servidor fixture local; sem
  essa permissao o runner ficava aguardando o servidor e nenhum caso iniciava.
- `npm run build`: exit code 0; Next.js compilou, validou tipos e gerou as 20
  paginas estaticas/rotas.
- A tentativa `git status --short --branch` pelo PowerShell nao funcionou:
  `.git` aponta para um worktree em `/home/gabbs/...` no WSL e o acesso atual
  nao foi disponibilizado. Branch e diffs permanecem por confirmar; nao editar
  em cima de uma suposicao nem contornar o bloqueio.
- Nenhuma credencial real foi usada. Fixture/E2E e build nao comprovam login
  real por email nem Google OAuth; a configuracao Google externa continua
  necessaria para validar consentimento, callback, sessao e logout.

### Retomada de autenticacao, 19 de outubro de 2026

- `wsl git -C /mnt/c/Users/gabbs/Documents/ChatGPT/M/millennium status --short
  --branch` confirmou a branch `feature/stripe-supabase-test-homologation` e
  alteracoes preexistentes em auth, testes e documentacao. Duas chamadas
  paralelas de `git diff` foram recusadas com `Wsl/E_ACCESSDENIED`; nenhum
  arquivo de implementacao foi alterado nesta retomada.
- O usuario concluiu no Google Cloud e Supabase: cliente OAuth Web em modo de
  teste, email de teste, origem `http://127.0.0.1:4313`, callback do Supabase,
  provedor Google habilitado e allow-list com
  `http://127.0.0.1:4313/auth/callback`. O segredo anteriormente exposto foi
  redefinido pelo usuario e salvo diretamente no painel Supabase. Nenhum
  segredo foi recebido ou usado pelo executor nesta retomada.
- Nao ha `.env.local` nem variaveis Supabase no ambiente local. O endpoint de
  login renderizou HTTP 200 com aviso de ambiente desconectado; a verificacao
  Playwright em 1440px e 390px confirmou campos email/senha, botao Google visivel
  mas desabilitado, aviso de desconexao e ausencia de overflow horizontal.
  Esses resultados validam somente a tela sem configuracao, nao o OAuth real.
- `npm run test:payments`: 77/77 aprovados; `npm run typecheck`: exit code 0;
  `npm run lint`: exit code 0. `npm run build` passou com permissao de escrita
  em `.next`; a tentativa dentro do sandbox falhou com `EPERM`.
- O servidor local temporario foi encerrado. Nenhum login real, consentimento,
  callback PKCE, sessao, logout ou login por email foi concluido nesta rodada.
- Proximo passo: criar `.env.local` localmente com somente a URL Supabase e a
  chave publica Publishable/anon, reiniciar o servidor e testar login Google e
  email, callback, logout e novo login. Nunca solicitar o segredo Google ou
  qualquer token no chat. Sem Stripe, Pix, KYC, deploy, push ou commit.

### Revalidacao apos configuracao local, 19 de outubro de 2026

- O usuario criou `.env.local`. Verificacao sem imprimir valores confirmou
  somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, URL do
  projeto esperada e prefixo `sb_publishable_`. `.gitignore` ignora `.env.local`.
- `npm run test:payments`: 77/77 aprovados. `npm run typecheck`: aprovado.
  ESLint do arquivo alterado passou. O `npm run lint` completo desta rodada
  demorou sem emitir resultado e foi interrompido; lint completo anterior consta
  aprovado no checkpoint acima.
- O primeiro build com ambiente configurado revelou que
  `generateStaticParams` em `src/app/articles/[slug]/page.tsx` chamava o cliente
  SSR e `cookies()` fora de um request. A consulta de slugs publicos agora usa
  cliente Supabase sem cookies. O build seguinte passou, incluindo coleta de
  dados e geracao das 20 rotas.
- Next.js carregou `.env.local` e serviu `/auth/login` com HTTP 200. O clique
  em “Continuar com Google” chegou a selecao de conta do Google. A URL observada
  tinha callback Supabase e retorno local `/auth/callback?next=%2Fdashboard`,
  com escopos email/perfil. Em seguida, o usuario enviou captura do painel
  local `/dashboard/checkout` com sessao autenticada. Isso e evidencia visual
  de retorno ao Millennium apos login Google local; nao comprova logout, novo
  login, login por email ou comportamento na Vercel.
- A execucao da suite pelo WSL falhou porque o `node_modules` compartilhado
  contem o binario Windows do esbuild; a mesma suite passou no Windows. Nao
  reinstalar dependencias no checkout compartilhado sem coordenar a plataforma.
- Proximo passo: validar logout e novo login, registrar se email/senha ja tem
  usuario de teste e configurar ambiente de Preview Vercel somente depois de
  verificar as variaveis sem imprimir valores secretos. Se houver erro,
  reportar somente a mensagem sem credenciais, codigos ou tokens.
- A consulta terminal a `/auth/v1/settings` foi bloqueada pela rede do ambiente.
  HTTP 200 do app, build e chegada ao seletor Google nao comprovam callback,
  sessao, logout ou login por email concluidos.
- Nenhuma chave foi impressa; nenhuma conta ou permissao foi manipulada pelo
  executor. Nao houve deploy, push, commit, pagamento ou mudanca remota.
