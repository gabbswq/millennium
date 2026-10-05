# Busca e fixtures: regressao de seguranca

Data: 2026-10-05. Base develop 6055fb6d; feature/security-static-regressions.
Escopo: alertas CodeQL 1, 2 e 5. Nenhuma publicacao main/Pages/Vercel,
credencial, migration, cobranca real ou redesenho do portfolio.

## Alteracoes e limites da prova

- Busca de index.html usa createElement/textContent/replaceChildren, sem
  interpolar titulos/categorias em HTML. Classes de categoria restritas as
  cinco existentes; textos, layout e filtros preservados.
- Fixture fake-provider executa arquivo fixo com argumentos, sem gerar fonte
  Node -e. Descendente continua herdando o grupo e pode resistir SIGTERM para
  testar encerramento forcado. Caminho com espacos, $, & e parenteses e literal.
- Checker de bundle calcula bytes e gzip do mesmo buffer, sem stat separado.
  Budget continua 150 KiB gzip e conta somente JavaScript.

Reproduzidos antes: titulo/category sinteticos viravam elementos HTML na busca,
em desktop/mobile; metadado stat sintetico media 999999 bytes para um buffer
de 13 bytes. Isso prova os caminhos locais, nao entrada remota maliciosa atual:
os artigos reais dessa pagina sao estaticos. Nenhum pentest contra terceiros.
No alerta da fixture, foi removida geracao de codigo; nao houve demonstracao
de escape de JSON.stringify ou de exploracao de um provedor de producao.

## Testes locais

- [x] Dez casos de busca desktop/mobile no Chrome instalado, rede externa bloqueada.
- [x] Quatro casos de medicao no Windows e Ubuntu; metadados, gzip, CSS e excesso.
- [x] 45 executor/arquivos Ubuntu apos trocar fixture; zero SKIP.
- [x] Cancelamento forcado especifico revalidado com caminho literal especial.
- [x] Capturas desktop/mobile inspecionadas, resultado sem overflow/markup.
- [x] Build landing e checker reais: JS 116387 bytes, gzip 46061/153600 bytes.
- [x] CI do codigo final e CodeQL da feature.
- [ ] Integracao develop e alertas consultados explicitamente nessa ref.

Termo normal do teste foi corrigido de claude (dois artigos existentes) para
claude 4 (um artigo); conteudo real nao foi modificado para fazer o teste passar.
Harness de medicao usa file URL no --import, necessario no Windows. Falha
inicial de import nao foi contada como reproducao da medicao divergente.
Dependencias locais da landing estavam ausentes; restauradas pelo lockfile,
ignore-scripts, sem alteracao de versoes. Build passou com warning de content
Tailwind; configuracao visual nao foi alterada neste incremento.

Codigo dd3795cf95688f7de9280928202360f0dda95862 aprovado no
[CI seguranca](https://github.com/gabbswq/millennium/actions/runs/37305524147)
e [executor](https://github.com/gabbswq/millennium/actions/runs/37305524100):
45 executor/arquivos, quatro bundle e dez navegador, 59 casos unicos.
Build/checker landing confirmam gzip JS 46061/153600 bytes. CodeQL da mesma
revisao: analise 1892950884, results_count=0, error/warning vazios.
API alerts com ref=refs/heads/feature/security-static-regressions e state=open
retornou lista vazia. Sem exclusoes/supressoes ou fechamento manual. Confirmar
a ref develop apos integrar; nao inferir estado da branch main.

Saida do Playwright isolada em test-results/security-search, nao no diretorio
que compartilha outros caches. CLI agent-browser nao estava disponivel;
testes/capturas usam o Playwright existente e Chrome local em perfil efemero.
Nao validar fontes/CDN externos bloqueados como parte desta prova visual.

## CI

Security workflow inclui index.html, landing e novos testes no gatilho.
Novo job regressions tem apenas contents:read, checkout sem credenciais
persistidas e SHAs oficiais fixados. Node 22, npm ci --ignore-scripts,
landing build/checker, quatro testes Node e dez de navegador. Sem secrets,
upload Pages, schedule ou deploy. CodeQL continua separado, sem npm/autobuild.
SHA setup-node v6 verificado pela API oficial: 249970729cb0ef3589644e2896645e5dc5ba9c38.

Scanner verde nao significa ausencia de alertas. Nao fechar/suprimir manualmente;
comparar a ref explicita apos analise e integrar somente develop.

## Meta ampla

Auth/CAPTCHA reais, dois donos, Checkout/webhook Stripe TEST externos,
WAF/limites financeiros e patch PostgreSQL continuam pendentes. Nenhuma
dessas provas e substituida por consertar busca ou fixtures. Login Vercel ainda
depende de Gabriel; nao ler/copiar credenciais nem alterar plano para contornar.

Fontes: [MDN textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent),
[Node child_process](https://nodejs.org/docs/latest-v22.x/api/child_process.html),
[baseline](SECURITY_SCAN_BASELINE.md) e [programa de seguranca](SECURITY_PROGRAM.md).
