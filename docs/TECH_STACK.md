# Tecnologias do Millennium

[Direção do produto](PRODUCT_BRIEF.md) · [Arquitetura proposta](MILLENNIUM_SPEC.md)

## Setup pessoal atual

| Parte | Tecnologia e limite |
| --- | --- |
| Ambiente | VS Code com Ubuntu/WSL; código no sistema de arquivos Linux |
| Versionamento | Git e worktrees para contextos separados |
| Assistente | Painel Codex; Claude Code preparado, sujeito ao acesso e à validação própria |
| Acesso ao fluxo | Extensão privada Millennium e iniciador Windows no setup pessoal |
| Registros | Conversas exportáveis em TXT e documentos Markdown para passagem de turno |
| Alternativa de operação | tmux e scripts anteriores preservados; não são requisito para usar o painel |

Essas peças não formam um orquestrador automático. O clone público não instala a extensão privada nem fornece as contas dos assistentes.

## Landing de apresentação

Vite, TypeScript, CSS e GSAP. Testes de navegador com Playwright e verificações de acessibilidade com axe. O build é estático e o workflow publica somente `landing/dist` no GitHub Pages.

As dependências e os comandos ficam em [landing/package.json](../landing/package.json). A landing não depende de Supabase, Stripe ou de um servidor de agentes.

## Aplicação experimental preservada

Next.js, React, TypeScript, Tailwind, componentes Radix, Supabase/PostgreSQL e Edge Functions com código de integração Stripe. Há páginas de conteúdo, catálogo, autenticação e APIs experimentais.

As versões exatas ficam no [lockfile](../package-lock.json); os scripts ficam em [package.json](../package.json). A presença de código ou dependências não comprova autenticação configurada, webhook validado ou pagamento ponta a ponta. Este experimento não é a fábrica operacional nem um gateway pronto.

## Laboratório de pagamentos

O laboratório Pix em `payments-sandbox/` já usa Fastify, QRCode, Lucide e
Playwright. A continuidade online prepara PostgreSQL/Supabase com schema
separado e testes SQL; PGlite e o cliente `pg` são ferramentas de teste,
não dependências do navegador. Não há banco hospedado ou autenticação
online homologada. Consulte a [SPEC de pagamentos online](PAYMENTS_ONLINE_SPEC.md).

## Propostas, não dependências já adotadas

- Reaproveitar TypeScript e React/Next.js onde isso simplificar a interface local.
- Avaliar um executor Node com integração documentada do assistente.
- Avaliar SQLite para o histórico local de turnos e tentativas.
- Reaproveitar Fastify no backend de pagamentos; não adicioná-lo ao executor sem necessidade.
- Definir hospedagem e acesso remoto após validar uso e orçamento.

Não é necessário instalar MySQL, uma VPS ou vários frameworks para seguir o primeiro turno no VS Code. OpenRouter, Ollama e Qwen continuam como possibilidades, não integrações presentes.

## Validação

O escopo dos ensaios existentes está em [WORKFLOW_VALIDATION.md](WORKFLOW_VALIDATION.md). A [SPEC](MILLENNIUM_SPEC.md) define o que ainda precisa ser comprovado em uso real. Testes de build, exportação ou tipos não medem sozinhos usabilidade nem economia de tokens.

O inventário anterior está preservado no [histórico](history/previous-product-direction/README.md).
