# SPEC: Segurança e qualidade do repositório

**Status:** checkpoint WIP criado em `codex/security-quality-checkpoint`; revisão e integração ainda pendentes
**Data:** 2026-09-27 (estado técnico registrado); checkpoint em 2026-10-19
**Base do relatório:** scan GitGuard no commit `8d16366b1c95`

## 1. Objetivo

Reduzir os riscos confirmados no relatório, manter o app experimental verificável e organizar as próximas melhorias sem transformar a landing pública em produto web, migrar banco de dados ou ativar pagamentos reais.

## 2. Estado atual e evidências

Correções já aplicadas no checkout `~/ai-projects/gabbs-product-factory`:

- Dependências atualizadas no lockfile: Next.js `15.5.26`, nanoid `3.3.19`, PostCSS `8.5.28`, sharp `0.35.4` e ws `8.22.0`.
- `package.json` fixa PostCSS transitivo na versão direta segura por meio de `overrides`, para evitar a cópia vulnerável aninhada no Next.js 15.
- Actions do GitHub Pages fixadas em SHAs imutáveis, com tags legíveis em comentários.
- O webhook não registra mais no log o corpo retornado por `provision-discord` quando há erro.
- O CSS versionado do Font Awesome no `index.html` legado agora usa SRI.

Validações registradas na rodada de implementação:

- `npm audit`: 0 vulnerabilidades.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado em Next.js `15.5.26`.
- `git diff --check`: aprovado na rodada de implementação e novamente antes do checkpoint WIP em 2026-10-19.

O lint não está validado: `npm run lint` chama `next lint`, que abre um assistente interativo porque ainda não há configuração ESLint. Nenhuma compra Stripe real nem teste de Edge Function foi executado. Em 2026-10-19, o trabalho foi separado do `main` e registrado como checkpoint WIP na branch `codex/security-quality-checkpoint`; não foi integrado em `main`, publicado por deploy, nem validado novamente com audit/typecheck/build nesta etapa.

## 3. Requisitos da próxima rodada

### P0 — Revalidar o relatório

- Rodar um novo scan no diff final, não reutilizar como atual o relatório criado no commit-base.
- Confirmar que o scanner reconhece os SHAs, o lockfile e o override do PostCSS.
- Registrar achados remanescentes com severidade, caminho e evidência reproduzível.
- Não fazer push, deploy nem rotacionar credenciais sem autorização explícita e sem evidência de exposição.

**Aceite:** auditoria nova anexada ao commit candidato; nenhuma vulnerabilidade crítica/alta sem mitigação registrada.

### P1 — Tornar a qualidade repetível no CI

- Substituir o lint interativo por configuração ESLint compatível com a versão instalada e um comando não interativo.
- Criar workflow de CI para a aplicação Next: instalação reproduzível, `npm audit`, lint, typecheck e build em pull requests e pushes relevantes.
- Manter o workflow de Pages separado para que a publicação continue construindo apenas `landing/`.
- Fixar actions por SHA e conceder somente permissões necessárias.

**Aceite:** workflow executa sem segredos e sem prompts interativos; falha em lint, auditoria, tipos ou build bloqueia o check; workflow da landing continua publicando somente `landing/dist`.

### P1 — Testar integrações críticas sem dinheiro real

- Adicionar testes de unidade para a Edge Function de webhook: assinatura ausente/inválida, evento válido, evento duplicado, falha de persistência e falha no provisionamento Discord.
- Validar idempotência e garantir que respostas/logs não exponham credenciais nem corpos internos.
- Testar APIs de checkout e acesso com estados autenticado/não autenticado e acesso negado/concedido.
- Usar mocks ou Stripe/Supabase locais; não usar credenciais ou pagamentos de produção.

**Aceite:** testes automatizados cobrem os caminhos de sucesso e falha; nenhuma chamada real de cobrança é necessária para CI.

### P1 — Revisar autorização antes de habilitar vendas

- Conferir policies RLS, migrations e validação server-side de identidade e acesso pago.
- Confirmar que o webhook Stripe valida a assinatura antes de qualquer efeito e que eventos repetidos não duplicam concessões.
- Manter o botão Comprar desativado até checkout, webhook, concessão de acesso e recuperação de falha passarem em ambiente de teste.

**Aceite:** matriz de autorização documentada e testes negativos aprovados; o estado experimental permanece claramente indicado até isso acontecer.

### P2 — Resolver dependência externa de fontes

- O Google Fonts continua sendo stylesheet externo sem SRI, porque a resposta pode variar conforme o navegador.
- Avaliar hospedar localmente apenas os arquivos/fontes necessários, verificar licenças e comparar a aparência antes de substituir a fonte remota.

**Aceite:** ativos locais com origem/licença documentadas e revisão visual; ou decisão registrada para aceitar conscientemente a dependência externa.

### P2 — Inventariar artefatos legados

- O `index.html` da raiz ainda identifica o antigo projeto VOID CRYPT e carrega fontes/CDN externos; sua relação com o produto atual não está confirmada.
- Descobrir se ele está publicado ou referenciado antes de renomear/remover. Não apagar como parte desta SPEC.

**Aceite:** registrar proprietário, URL/uso e decisão de manter, arquivar ou remover em uma tarefa separada.

## 4. Fora de escopo

- Migrar Supabase/PostgreSQL para MySQL.
- Construir chat, IDE web, clone do Replit ou sistema de agentes no navegador.
- Ativar checkout/cobrança real, publicar a aplicação experimental ou alterar credenciais.
- Limpar clones, worktrees ou diretórios pessoais sem inventário e aprovação.
- Mudar a landing além dos ajustes de segurança diretamente relacionados.

## 5. Ordem de execução sugerida

1. Atualizar este estado com um scan novo e decidir os achados residuais.
2. Corrigir lint e criar CI reproduzível para a aplicação Next.
3. Adicionar testes de webhook e APIs usando serviços locais/mocks.
4. Fazer revisão de RLS/autorização e validar o fluxo de pagamento de ponta a ponta em modo de teste.
5. Decidir sobre Google Fonts e o HTML legado após identificar uso real.

Cada etapa deve ser uma tarefa pequena, com diff próprio, testes e aprovação antes de commit, push ou deploy.
