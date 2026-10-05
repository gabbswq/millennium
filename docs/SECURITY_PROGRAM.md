# Millennium: meta de seguranca

Data: 2026-10-04. Base: develop e9387f3c. Escopo desta etapa: APIs de
Checkout/Auth/Connect, limites de recursos, cadeia de CI e modelo de ameacas.
Nao e auditoria completa, certificacao PCI, pentest cloud ou liberacao de dinheiro real.

## Uso das skills

Referencia comunitaria, nao afiliada a Anthropic: [repositorio indicado por Gabriel](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/tree/54a798831d2266a3ca61ce68a7acb80b81160d57).
Revisao fixada: 54a798831d2266a3ca61ce68a7acb80b81160d57, Apache-2.0.
Leitura seletiva dos guias; nenhum script do repositorio executado e nenhuma
skill instalada globalmente. O restante da biblioteca nao foi auditado.

| Guia revisado | Aplicacao no Millennium | Limite da adaptacao |
| --- | --- | --- |
| [API rate limiting](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/54a798831d2266a3ca61ce68a7acb80b81160d57/skills/implementing-api-rate-limiting-and-throttling/SKILL.md) | Resposta 429 com prazo restante; backpressure antes de ler sync-provider | Nao confiar em X-User-ID/X-User-Tier do browser, nem instalar Redis. Identidade vem de getUser. |
| [Threat modeling](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/54a798831d2266a3ca61ce68a7acb80b81160d57/skills/performing-threat-modeling-with-owasp-threat-dragon/SKILL.md) | Ativos, fluxos, fronteiras e ameacas abaixo | Modelo em Markdown, sem instalar GUI/Docker ou presumir conformidade. |
| [SAST na CI](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/54a798831d2266a3ca61ce68a7acb80b81160d57/skills/integrating-sast-into-github-actions-pipeline/SKILL.md) | CodeQL JS/TS, security-extended, em pushes/PRs | Sem agenda, servico pago, tokens novos, Semgrep remoto ou alterar branch protection. |

Os exemplos sao material de terceiros, nao autorizacao operacional. Pentests
de Stripe/Supabase, carga remota, phishing, exploits e C2 estao fora do escopo.

## Criterios da etapa

- [x] Ler somente referencias relevantes e registrar revisao/procedencia.
- [x] Reproduzir leitura travada, cancelamento travado, desconexao e 429 incompleto.
- [x] Implementar leitura com limite total de 5s, preservando bytes e limites existentes.
- [x] Informar Retry-After real do limitador local, sem inventar prazo para quota diaria.
- [x] Limitar sync-provider antes de ler corpo ou buscar identidade remota.
- [x] Adicionar analise estatica de JS/TS com acoes oficiais fixadas por SHA.
- [x] Auditar ferramentas de desenvolvimento e atualizar patches/minors compativeis.
- [x] Validar lint, build, CI de pagamentos e primeira analise CodeQL; revisar resultados.
- [x] Integrar somente develop apos verificacao. Main/preview nao fazem parte desta etapa.

Checkpoint 2026-10-05: integracao local em develop sem conflitos, codigo
identico ao verificado na feature. Publicacao/checks da integracao devem ser
conferidos no GitHub antes de declarar esse checkpoint remoto concluido.

## Ativos e fronteiras

Ativos: sessoes, identidade confirmada, perfis privados, pedidos e estado de
pagamento, links privados de Checkout, credenciais server-only, disponibilidade
e orcamento. Documentos KYC e dados de cartao ficam na Stripe, nao no Millennium.

```text
Browser nao confiavel
  -> Next.js: origem, limite de ingresso/corpo, identidade verificada
  -> Supabase Auth: getUser, nao metadata editavel
  -> Postgres: RLS/grants para cliente; RPC privilegiada para reserva/claim
  -> Stripe TEST: preco conferido no servidor, destino/retorno nao vindos do browser
Stripe TEST
  -> webhook Next.js: corpo original, assinatura, tipo/conta/livemode
  -> RPC Postgres: deduplicacao e transicao transacional
GitHub CI
  -> codigo publico e fixtures descartaveis; sem credenciais de producao
```

Fronteiras: internet/servidor, cliente/RLS, servidor/service_role, servidor/Stripe,
webhook nao verificado/evento validado e repositorio/acoes externas. Um browser
tambem pode chamar Supabase diretamente; limites Next.js nao protegem esse caminho.

## Registro de ameacas

Prioridades relativas ao rollout, nao pontuacoes CVSS inventadas. Responsavel
tecnico: desenvolvimento; configuracoes e mudancas cloud: Gabriel autoriza.

| ID / classe STRIDE | Ameaca e impacto | Controle/evidencia atual | Estado / proxima prova |
| --- | --- | --- | --- |
| S-01 / S,E | Forjar dono, provider ou papel para acessar pedidos | getUser, identity binding, grants/RLS; testes provider/SQL | Parcial: validar dois logins/JWT reais antes de abrir ao publico. |
| S-02 / T,E | Alterar valor, destino ou return URL | Payload so price_id/request_id, preco comparado na Stripe; guards/checkout tests | Local validado; homologacao Stripe TEST ainda pendente. |
| S-03 / T,R | Replay/falsificacao de webhook ou considerar completed como paid | Assinatura oficial, janela temporal, test-only, dedup e transacao SQL | Dominio/SQL validados; ensaio externo de webhook pendente. |
| S-04 / I,E | Expor URL privada, snapshot ou escrita privilegiada | Grants/colunas, invoker views, snapshot server-only; 40 casos SQL e probe remoto anterior | Schema validado; inventario de toda superficie publica nao completo. |
| S-05 / D | Cliente mantem leitura aberta ou trava cancelamento | Deadline total 5s, abort, cancel sem espera; 10 novos testes HTTP | Implementado; validar CI. Timeout de conexao/ingresso do host ainda pendente. |
| S-06 / D | Flood esgota processo, Auth ou fatura | Backpressure local, quotas SQL, flags Stripe off; sync ingress novo | Aberto: WAF/distribuido, rate limits Auth, alertas e teto financeiro verificados no host. |
| S-07 / T,E | Dependencia/acao comprometida altera codigo | Lockfile, npm ci --ignore-scripts na CI; CodeQL oficial fixado; audit completo de 35 para 7 entradas | Parcial: sete alertas dev, demais workflows por tag e manutencao de pins precisam revisao. |
| S-08 / T,E | Falha do Postgres remoto sem patch | Advisor anterior: 17.4.1.075 com patches pendentes | Gate: upgrade somente com autorizacao, backup/recuperacao e janela planejada. |
| S-09 / R,I | Incidente sem rastreabilidade ou logs com dados privados | Erros HTTP genericos, sem dump de chaves/body | Aberto: correlacao, retencao e alerta operacional sem PII. |

O schema remoto foi validado em etapa anterior, documentada em
[SUPABASE_BOOTSTRAP_EVIDENCE.md](SUPABASE_BOOTSTRAP_EVIDENCE.md). Nao foi
retestado nem alterado nesta etapa de codigo. Ensaio SQL com claims nao e prova
de login/JWT. Dependencias sem alertas conhecidos nao provam ausencia de falhas.

## Decisoes e comportamento

Leitura: limite total, nao renovado por pequenos chunks. Corpo vazio nao precisa
esperar; desconexao gera 400, prazo excedido 408 e excesso de bytes 413. O leitor
e liberado em sucesso/erro; cancelamento nao cooperativo nao impede a resposta.
O prazo e uma decisao conservadora para JSON de 1 KiB e webhook de 64 KiB;
calibrar com trafego legitimo em homologacao, sem aumentar limites cegamente.

429 local informa segundos inteiros restantes, inclusive saturacao de memoria.
Quota SQL diaria sem prazo conhecido nao recebe Retry-After ficticio de um minuto.
Este limitador e por processo e pode afetar usuarios legitimos durante abuso;
nao garante limite global, protecao DDoS ou teto de cobranca.

SAST usa runner hospedado, permissoes contents:read e security-events:write
apenas no job de analise, sem npm/autobuild ou segredos de negocio. Checkout
nao persiste credenciais. Sem schedule/auto-merge/deploy. Job verde significa
analise executada, nao zero alertas: revisar SARIF/alertas e registrar a revisao.
Nao criar bloqueio de merge por administracao sem autorizacao humana.

[Baseline historica e triagem atual](SECURITY_SCAN_BASELINE.md).
CI do codigo 216f0357 passou com 131 casos unicos; o incremento HTTP foi
verificado, mas a meta ampla de seguranca continua aberta.

Checkpoint 5 de outubro: hardening de arquivos integrado e verificado em
develop 4e4f9c37; seis alertas fixed e cinco open na API CodeQL dessa ref.
Feature security-ingress-limit acrescenta limites Fastify locais; [controle,
regressoes e gates](SECURITY_INGRESS_LIMITS.md). Ainda nao e protecao de
fatura/ingresso hospedado nem autorizacao de pagamentos reais.

## Dependencias: evidencia local

Auditoria completa antes: 35 entradas (13 high, 21 moderate, 1 low).
Depois das atualizacoes compativeis: 7 high; npm audit continua com exit 1.
Sao entradas de pacotes, com propagacao transitiva, nao 35/7 CVEs distintas.
Nao executar audit fix --force, downgrade de Next/ESLint ou migracao Tailwind
major como resposta automatica. Nenhuma dependencia nova ou faixa do manifesto.

Lockfile revisado: postcss 8.5.13 -> 8.5.28, js-yaml 4.1.1 -> 4.3.2,
brace-expansion 1.1.14/5.0.5 -> 1.1.21/5.0.12, selector-parser 6.1.2 -> 6.1.4,
baseline-browser-mapping 2.10.24 -> 2.11.27 e browserslist 4.28.2 -> 4.29.3.
Dados transitivos de browserslist atualizados; PostCSS duplicado deduplicado.
Instalacao limpa local com ignore-scripts e cache em test-results, sem hooks.

Restam braces 3.0.3 e propagacao a micromatch, fast-glob, chokidar, Tailwind,
@next/eslint-plugin-next e eslint-config-next. Risco de stack exhaustion em
patterns controlados pelo atacante: [advisory braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Esses caminhos sao de ferramentas dev/build; nao tratar input de PR como
confiavel nem usar segredos/runners privados nos testes. Um upgrade de cadeia
maior exige escopo e regressao proprios. Producao sera auditada separadamente
pela CI; nenhum resultado aqui certifica todo o software.

Lint e build locais anteriores aos patches passaram; o lockfile final passou
no CI com npm ci --ignore-scripts, lint, dominio, SQL e navegador.
Nao apresentar tempo dos testes unitarios como latencia real de rede.

## Proximos gates

1. Definir host HTTPS e confirmar limites financeiros, WAF e timeout no ingresso.
2. Planejar patch PostgreSQL com autorizacao separada e recuperacao verificavel.
3. Homologar Auth/CAPTCHA imposto no servidor e dois donos reais isolados.
4. Homologar Checkout/webhook Stripe TEST e falhas ambiguias, sem dinheiro real.
5. Revisar alertas SAST/dependencias e decidir protecao de secrets/branches.
6. QA humana; somente depois preparar preview e uma release autorizada.

## Fontes primarias

- [OWASP: DoS](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html): validacao barata primeiro e protecao em camadas.
- [OWASP: threat modeling](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html): fronteiras e ameacas com mitigacoes verificaveis.
- [GitHub: uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use): permissoes minimas e SHA completo.
- [CodeQL init oficial](https://github.com/github/codeql-action/blob/2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2/init/action.yml): build-mode none e ferramentas linked.
