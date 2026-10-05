# Hardening de arquivos locais

Data: 2026-10-05. Base develop 34354a02; feature/security-file-descriptors.
Escopo: leituras de estado/lock/fingerprint e fallback do executor, incluindo
Repository do laboratorio Pix. Nenhuma migration, segredo, pagamento ou UI.

## Evidencia antes da correcao

Quatro falhas reproduzidas em fixtures descartaveis, sem servicos externos:

- Store.read seguia um arquivo trocado por symlink depois da verificacao.
- Repository consumia o estado externo antes de recusar a escrita posterior.
- fingerprint seguia um arquivo regular trocado por symlink.
- Fallback de resposta sobrescrevia um arquivo criado por outro escritor.

Nao houve leitura de credenciais ou dados de usuario. O alvo externo dos
ensaios tambem era sintetico, dentro da pasta temporaria exclusiva do teste.

## Alteracoes

Leitor comum files.mjs abre em modo somente leitura, usa O_NOFOLLOW/O_NONBLOCK
quando disponiveis, valida arquivo regular e identidade dev/ino da entrada
contra o descritor e le pelo descritor ja aberto. Fecha em sucesso/erro.
Arquivo ausente continua opcional onde ja era; symlink pendente nao e confundido
com entrada ausente. JSON corrompido nao e sobrescrito automaticamente.

O fallback usa criacao exclusiva wx, respeita EEXIST e valida a resposta pelo
leitor comum. Resposta insegura registra falha/bloqueio sem repetir o provedor,
sem alterar o alvo externo e sem deixar run.lock. Os demais estados persistidos,
CSRF, origem, idempotencia e recuperacao ambigua continuam iguais.

CI Pix passa a acompanhar changes no helper compartilhado. CI local ganha
timeout de dez minutos. Nenhuma dependencia nova.

## Verificacao

- [x] Reproduzir quatro falhas antes da implementacao.
- [x] Suite local Ubuntu: 44 casos de executor/arquivos, zero SKIP; 12 novos.
- [x] Suite local Pix Ubuntu: 39 casos HTTP/provedor/receptor, zero SKIP.
- [x] Leitor Windows: seis casos aprovados, um SKIP explicito de symlink.
- [x] CI de executor/Pix, build/navegador e SQL em PostgreSQL 17/18.
- [x] Nova analise CodeQL e comparacao de alertas na mesma ref.
- [ ] Integrar somente develop apos evidencia; main/preview preservadas.

Suíte Pix Windows: 38/39; o teste antigo de symlink falhou EPERM na criacao do
fixture. Nao foi reescrito para aparentar aprovacao. Ubuntu/CI sao a prova dos
ensaios POSIX. Nao contar repeticoes da suite em workflows/matrizes como casos novos.

Codigo db4ef4cd aprovado no [CI Pix](https://github.com/gabbswq/millennium/actions/runs/37263656254)
e [CI executor](https://github.com/gabbswq/millennium/actions/runs/37263656249):
39 API/receptor, 44 executor/arquivos, 19 SQL nativos por versao 17/18 e 12
navegador desktop/mobile. Build Pix aprovado. Sao 114 casos unicos, sem
somar a segunda execucao do executor ou as repeticoes SQL/PGlite.

[CodeQL](https://github.com/gabbswq/millennium/actions/runs/37263656308) executou
security-extended, sem exclusoes/supressoes. API consultada com a ref explicita
feature/security-file-descriptors: cinco alertas abertos (4 high, 1 medium),
contra onze da baseline. Os IDs 6-11 nao aparecem na nova lista dessa ref.
Isso nao afirma fechamento global/default branch nem seguranca completa.
Restam IDs 1 (DOM/innerHTML), 2 (fixture com codigo gerado), 3/4 (rate limit
do Fastify) e 5 (medicao de bundle com stat/read separados).

## Limites

Isto nao isola um processo local hostil com acesso aos mesmos diretorios.
Pastas pais devem ser privadas/confiaveis. O_NOFOLLOW protege a ultima entrada,
nao fornece openat por descritor de diretorio. Trocas em pastas pais, hardlinks,
alteracao de conteudo por outro escritor e corrida token/unlink exigem limites
de permissao/isolamento e revisao propria; nao afirmar protecao completa.

Windows nao oferece os mesmos flags POSIX. Dev/ino e tipo sao conferidos antes
de consumir bytes, mas seis casos sem symlinks nao homologam todos os reparse
points/junctions ou garantem equivalencia atomica. Nao habilitar Developer Mode
ou elevar privilegios do usuario apenas para fazer o teste passar.

Estes ensaios nao validam latencia de rede nem WAF/teto financeiro. Os alertas
historicos do CodeQL continuam abertos ate a nova analise; testes verdes nao
sao motivo para suprimi-los. Vercel/Auth/Stripe TEST externos e patch Postgres
continuam gates da meta completa.

## Referencias

[Node.js: flags e descritores](https://nodejs.org/docs/latest-v22.x/api/fs.html):
suporte de O_NOFOLLOW/O_EXCL, diferencas Windows e leitura por descritor.
[Baseline anterior](SECURITY_SCAN_BASELINE.md) registra os onze alertas iniciais.
