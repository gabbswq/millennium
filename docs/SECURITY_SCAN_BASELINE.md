# Baseline de seguranca: 2026-10-04

Codigo: 216f0357, feature/security-api-bounds, base develop e9387f3c.
Esta e uma primeira triagem por leitura, nao um pentest nem aceite de risco
em producao. Os onze alertas estavam abertos nessa revisao; nenhum foi
suprimido/dispensado. Ver checkpoint integrado abaixo para o estado atual.

## Evidencia automatica

[CI de pagamentos](https://github.com/gabbswq/millennium/actions/runs/37214121308)
aprovado no lockfile final, Node 22:

- 67 casos de dominio/auth, dez novos, zero SKIP.
- 40 casos SQL nativos em PostgreSQL 17 e 18, zero SKIP por versao.
- 12 casos de navegador e 12 de CAPTCHA, desktop/mobile.
- Lint, build/tipos e npm audit --omit=dev: zero vulnerabilidades conhecidas.
- PGlite: 34/40, seis SKIP de concorrencia; nao somar a matriz novamente.

Total: 131 casos unicos. Isto nao prova Auth/JWT/Stripe reais nem um sistema
hospedado sem falhas. Auditoria completa local: 35 -> 7 entradas high de
ferramentas dev/transitivas; exit 1, nao aprovada. Ver [programa](SECURITY_PROGRAM.md).

[Primeira analise CodeQL](https://github.com/gabbswq/millennium/actions/runs/37214121334)
JS/TS security-extended executada e upload concluido. API code-scanning/alerts
consultada explicitamente com ref=refs/heads/feature/security-api-bounds:
11 abertos, 10 high e 1 medium segundo a ferramenta. Sucesso do workflow nao
e ausencia de alertas nem bloqueio automatico de merge.

## Triagem inicial

P1 = antes de publicar a superficie afetada; P2 = proximo incremento local;
P3 = higiene/fixture com baixa exposicao atual. Essas prioridades sao do projeto;
nao alteram as severidades originais e nao comprovam exploracao remota.

| Alerta / regra CodeQL | Local | Leitura e proxima acao | Prioridade |
| --- | --- | --- | --- |
| 1 / js/xss-through-dom (high) | index.html:1660 | Busca interpola texto do DOM em innerHTML. Titulos/categorias atuais sao locais; nao foi provada entrada remota. Trocar por criacao DOM/textContent e testar titulos com markup sem execucao, preservando visual. | P1 se abrir conteudo dinamico, P2 agora |
| 3 / js/missing-rate-limiting (high) | payments-sandbox/app.mjs:42 | Hook tem origem local/CSRF, mas sem limite de ingresso. Nao expor este laboratorio; testar limiter antes de I/O do provedor. | P1 antes de exposicao |
| 4 / js/missing-rate-limiting (high) | payments-sandbox/app.mjs:57 | Leitura sincrona de assets sem rate limit. Loopback reduz exposicao, nao substitui controle de recursos. Rever cache/leitura e backpressure, sem benchmark remoto. | P2 |
| 6 / js/file-system-race (high) | payments-sandbox/repository.mjs:30 | lstat/exists seguido de read permite troca entre verificacao e uso. Pasta privada e locks nao demonstram ausencia de corrida. Ler por descriptor/no-follow e testar troca de symlink em fixture. | P2 |
| 7 / js/file-system-race (high) | payments-sandbox/repository.mjs:69 | Recuperacao de lock faz verificacao antes de read. Rever descriptor/identidade e concorrencia, preservando recovery gate. | P2 |
| 8 / js/file-system-race (high) | payments-sandbox/repository.mjs:99 | close verifica link antes de read/unlink. Rever corrida e identidade do lock sem apagar dados existentes. | P2 |
| 9 / js/file-system-race (high) | scripts/millennium/project.mjs:60 | fingerprint verifica lstat antes de read. Pode seguir arquivo trocado por symlink. Limitar leitura por descriptor com regressao; nao usar repositorio hostil como confiavel. | P2 |
| 10 / js/file-system-race (high) | scripts/millennium/store.mjs:48 | Registro JSON verificacao/uso separado. Validar descriptor e identidade antes de consumir estado. | P2 |
| 11 / js/file-system-race (high) | scripts/millennium/runner.mjs:162 | Fallback de resposta usa exists + write sem wx; agente controla workspace. Preferir criacao exclusiva e teste com symlink/arquivo concorrente. | P2 |
| 5 / js/file-system-race (high) | landing/scripts/check-bundle.mjs:8 | stat e read independentes podem medir versoes diferentes de artifact. Nao ha decisao de privilegio pelo stat nesse trecho. Calcular tamanho do mesmo buffer; revisar resultado antes de classificar falso positivo. | P3 |
| 2 / js/bad-code-sanitization (medium) | scripts/millennium/tests/fake-provider.mjs:13 | JSON.stringify de caminho dentro de codigo Node -e; somente fixture de descendente resistente. Remover geracao de codigo via argumento/fixture dedicada, nao atribuir a sanitizacao seguranca de producao. | P3 |

Limites da revisao: os trechos referenciados e seus hooks foram lidos; nao houve
reproducao desses onze alertas, exploracao, dump de secrets ou varredura cloud.
Nao esconder caminhos/fixtures da analise para produzir um resultado verde.
O incremento desta branch corrige outro conjunto reproduzido de problemas HTTP;
nao afirma que resolveu este backlog inteiro.

Checkpoint posterior 2026-10-05: feature/security-file-descriptors reproduziu
quatro falhas de arquivo, implementou leitor por FD/fallback exclusivo e foi
validada em CI. CodeQL dessa ref retorna cinco alertas abertos; IDs 6-11
ausentes. Sem fechamento manual/exclusoes. A baseline acima continua historica;
[evidencia e limitacoes da correcao](SECURITY_FILE_HARDENING.md).

Checkpoint integrado 2026-10-05: develop 4e4f9c37 publicado, CI executor/Pix
e [CodeQL](https://github.com/gabbswq/millennium/actions/runs/37300227225) aprovados.
API consultada explicitamente com ref=refs/heads/develop: IDs 6-11 fixed;
IDs 1-5 open (4 high, 1 medium). Sem exclusoes, supressoes ou fechamento
manual. Main preservada. O quadro inicial nao deve ser lido como estado atual.

Feature security-ingress-limit, codigo 56a4f964: [CI](https://github.com/gabbswq/millennium/actions/runs/37302691893)
e [CodeQL](https://github.com/gabbswq/millennium/actions/runs/37302691853) aprovados.
Consulta explicita da ref da feature: tres open (IDs 1, 2, 5; 2 high/1 medium).
IDs 3/4 ausentes nessa ref; [prova de limites, concorrencia e superficie](SECURITY_INGRESS_LIMITS.md).
Sem supressao/exclusao. Integrado em develop 0dc9e9ca: [CI](https://github.com/gabbswq/millennium/actions/runs/37303081987)
e [CodeQL](https://github.com/gabbswq/millennium/actions/runs/37303082108) aprovados.
API dessa ref confirma IDs 3/4 fixed e tres open (IDs 1/2/5; 2 high/1 medium).
Main preservada; nenhuma promocao preview/release.

## Proximo turno

Primeiro: renderizacao DOM segura e teste de busca sem regressao visual.
Depois: fixture sem codigo gerado e medicao do bundle a partir do mesmo buffer.
Leitor por descriptor/fallback e limites de ingresso Fastify ja integrados;
seus limites permanecem documentados, sem declarar isolamento de processos
hostis, protecao de toda a internet ou teto financeiro. Reavaliar CodeQL na
mesma ref apos teste/scanner.
Nao reescrever o portfolio ou misturar novas features com essas correcoes.

Gates externos permanecem: patch PostgreSQL autorizado e recuperavel,
host/WAF/limites financeiros, Auth/CAPTCHA server-side e Stripe TEST externo.
Nenhuma release main/preview, credencial, plano ou operacao cloud foi alterada.
