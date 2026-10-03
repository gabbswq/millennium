# Millennium

**Uma fábrica pessoal de software: construir, revisar e aprender.**

Antes chamado Gabbs Product Factory. A marca e o repositório público passam a ser Millennium. Os caminhos locais antigos são preservados por compatibilidade; a landing usa o endereço /millennium/.

Uma base pessoal de trabalho para desenvolver produtos em tarefas pequenas, com contextos separados por papel e evidências que podem ser auditadas. Hoje a operação acontece no VS Code. A nova direção do Millennium é uma fábrica pessoal de software com turnos, execução, revisão e aprendizado; a interface própria e o acesso pelo celular ainda são propostas.

[Visão e SPEC do Millennium](docs/MILLENNIUM_SPEC.md) · [Meu primeiro turno](docs/PRIMEIRO_TURNO.md) · [Passagem de turno](docs/HANDOFF_MILLENNIUM.md)

[Começar no VS Code](docs/OPERATING_SYSTEM.md) · [Validação e limites](docs/WORKFLOW_VALIDATION.md) · [Regras para agentes](AGENTS.md)

[Visitar a landing page do projeto](https://gabbswq.github.io/millennium/)

## Prioridade atual: laboratório Pix (develop)

### Checkout e Vendedores

Gabriel confirmou **Stripe Checkout** como fluxo principal e pediu para manter
**Vendedores** em um menu independente. O app Next agora tem login, bloqueio por
email pendente, pedidos e cadastro Connect/KYC hospedado pela Stripe. Sem
configuracao, informa indisponibilidade e nao cria cobrancas ou contas.
Leia a [SPEC de acesso](docs/STRIPE_AUTH_KYC_SPEC.md) e o
[guia de homologacao](docs/STRIPE_CHECKOUT_SETUP.md).

Em uma copia de develop: `npm ci --ignore-scripts`, depois `npm run dev`.
Esse app exige backend Next e Supabase configurados; a landing no GitHub Pages
nao hospeda suas APIs. Integracoes aceitam somente chaves de teste nesta etapa.
Repasses/comissoes de vendedores, producao e hospedagem continuam pendentes.

Gabriel escolheu priorizar pagamentos em sandbox. O incremento separado em
[`payments-sandbox/`](payments-sandbox/) tem formulário, registros persistentes,
QR, estados, eventos e conciliação. O modo padrão é um **simulador local sem
dinheiro real e com QR não pagável**. O adaptador Asaas Sandbox tem testes de
contrato, mas a homologação externa e o uso observado por Gabriel ainda estão
pendentes. Não é um gateway em produção nem parte da landing pública.

O destino pretendido é acesso online pelo celular, contas e banco de dados,
seguido de pagamentos reais após validação e futuro aplicativo iOS. Local e
sandbox não são limitações permanentes. A [SPEC de homologação online](docs/PAYMENTS_ONLINE_SPEC.md)
separa esses marcos. A [base SQL de contas](payments-sandbox/database/README.md)
está em desenvolvimento/testes; o painel Pix JSON continua sem login/banco
multiusuario. O novo app Stripe tem seu proprio fluxo de autenticacao e schema,
ainda sem homologacao em contas externas.

Na raiz da cópia de desenvolvimento, em Ubuntu/WSL:

```sh
npm --prefix payments-sandbox ci --ignore-scripts
npm run pix:dev
```

Abra o endereço impresso no terminal. No VS Code, use **Millennium Pix: instalar
laboratorio** e depois **Millennium Pix: iniciar simulador**. Consulte o
[guia de teste](payments-sandbox/README.md) e a [SPEC Pix](docs/PIX_SANDBOX_SPEC.md).
O painel web de agentes ficou adiado, preservando o executor local abaixo.

## Turno local executável (develop)

O primeiro executor local permite abrir uma tarefa, planejar com Codex,
executar na feature, revisar, registrar um teste e salvar a passagem de turno.
Não precisa copiar respostas entre chats nem instalar as dependências do app
experimental. Precisa de Node 20+, Git, npm e Codex CLI no Ubuntu/WSL.

Na cópia de desenvolvimento, abra a raiz no VS Code e escolha **Terminal >
Executar Tarefa > Millennium: diagnostico do turno**. O diagnóstico não envia
prompts. O restante do fluxo
está no [guia do turno local](docs/TURNO_LOCAL.md).

Para obter o incremento em outra máquina, clone `develop` em uma pasta nova
(não sobrescreva um checkout existente):

```sh
git clone --branch develop https://github.com/gabbswq/millennium.git millennium-dev
cd millennium-dev
code .
```

No terminal Ubuntu da pasta aberta:

```sh
npm run millennium -- doctor
npm run millennium -- help
npm run test:millennium
```

Estado e respostas ficam em `.millennium/`, ignorado pelo Git. Escrita exige
`feature/*`; a resposta do agente não aprova a tarefa sozinha. O workflow de
testes não publica código. Este incremento não transforma a landing em um chat
web, não implementa pagamentos por si e ainda precisa ser usado por Gabriel para
validar a usabilidade.

## Como funciona

```text
Abrir o turno → definir uma tarefa → executar no VS Code
                                            ↓
                                 testar e revisar as mudanças
                                            ↓
                                 aprender → passar o turno
```

Exportar o TXT é opcional para auditoria externa; não é necessário reenviar todo o histórico na mesma conversa. Você decide a tarefa e autoriza as mudanças. O agente executa no contexto do projeto, o resultado é revisado e a próxima rodada recebe instruções específicas. Os quatro papéis não conversam nem trabalham automaticamente entre si.

## Começar

**No setup pessoal já instalado:** abra o atalho **Abrir Millennium.cmd**, confira **WSL: Ubuntu** e a janela **Millennium | lead**. Use o painel **Codex**. O menu **Millennium** permite abrir o guia, trocar de papel e exportar uma conversa salva.

**Para quem está chegando pelo GitHub:** clonar este repositório não instala o menu Millennium. A extensão privada, os atalhos e o exportador ficam no setup local; ainda não são distribuídos aqui. É possível abrir o código no VS Code e trabalhar com um assistente disponível, seguindo o mesmo procedimento de revisão.

O passo a passo, as pastas e um primeiro prompt estão no [guia de operação](docs/OPERATING_SYSTEM.md).

## Papéis

| Papel | Responsabilidade |
| --- | --- |
| Lead | Entender a ideia, delimitar tarefas e revisar resultados |
| Frontend | Telas, componentes, acessibilidade e interação |
| Backend | APIs, autenticação e regras de negócio |
| Database | Schema, migrations, consultas e permissões |

Os papéis usam **Git worktrees** para manter pastas e branches isoladas. Não é necessário abrir todos de uma vez. Novas tarefas usam `feature/* -> develop`; QA e release usam `develop -> preview -> main` apenas quando solicitados. O executor não faz commit, merge, push ou deploy.

## O que existe hoje

| Parte | Estado |
| --- | --- |
| Trabalho no VS Code + WSL | Setup pessoal configurado, com janelas por papel |
| Turno local com Codex CLI | Incremento em develop: plano, execução, revisão, testes e passagem de turno |
| Laboratório Pix | Simulador local testado; adaptador Asaas Sandbox sem homologação externa concluída |
| Exportação de conversas em TXT | Testada, sem teto artificial de linhas ou caracteres |
| Ciclo prompt → auditoria → nova resposta | Ensaio de leitura realizado; evidências revalidadas |
| Claude Code | Preparado no setup local; inferência não validada |
| OpenRouter, Ollama e Qwen | Possibilidades futuras, sem integração instalada |
| Orquestração autônoma entre agentes | Não implementada |
| Economia de tokens | Hipótese a medir, não resultado demonstrado |

O histórico completo fica como evidência. Na mesma conversa, envie os novos achados em vez de repetir tudo. Os limites do modelo e de anexos continuam existindo; o exportador não recupera conteúdo que o provedor não gravou.

## Landing page pública

A página pública apresenta o processo e aponta para este repositório. Ela é estática e separada do app experimental abaixo: não tem chat, cadastro, formulário, banco de dados ou execução de agentes no navegador.

No VS Code conectado ao WSL, abra a raiz do repositório. Use **Terminal > Executar Tarefa...** e escolha **Millennium: instalar landing** uma vez; depois use **Millennium: iniciar landing**. Para testar, rode **Millennium: instalar navegador de testes** uma vez e então **Millennium: validar landing**. O mesmo passo a passo está em [`landing/README.md`](landing/README.md).

O código, os testes de navegador e o workflow de GitHub Pages ficam em [`landing/`](landing/) e [`.github/workflows/pages.yml`](.github/workflows/pages.yml). O endereço público é [`gabbswq.github.io/millennium`](https://gabbswq.github.io/millennium/).

## Código experimental neste repositório

A fábrica nasceu junto de um projeto de conteúdo e produtos digitais. Esse código foi preservado e **não representa um gateway de pagamentos pronto para produção**.

Há páginas de artigos, catálogo e detalhe de produtos, autenticação, dashboard, APIs de produto e um proxy de checkout. Existem migrations e Edge Functions para checkout e webhook. O botão **Comprar** no detalhe do produto ainda está desativado; a presença dessas rotas não comprova pagamento de ponta a ponta.

| Tecnologia | Uso |
| --- | --- |
| Next.js 15, React 19 e TypeScript | Aplicação experimental |
| Tailwind CSS e Radix UI | Componentes e interface |
| Supabase e PostgreSQL | Autenticação, dados, RLS e migrations |
| Supabase Edge Functions e Stripe | Código de integração de pagamentos |
| VS Code, WSL e Git worktrees | Ambiente de desenvolvimento |
| Codex / Claude Code | Assistentes, sujeitos ao acesso de cada provedor |

As versões exatas estão em [`package-lock.json`](package-lock.json). tmux e scripts antigos foram preservados como alternativa; não são requisito do fluxo visual atual.

## Abrir o código

No terminal do Ubuntu/WSL:

```sh
git clone https://github.com/gabbswq/millennium.git
cd millennium
code .
```

Se a pasta já existe, abra a cópia atual em vez de clonar novamente. No VS Code, **Arquivo > Abrir Pasta** também permite selecionar o projeto.

Para executar a aplicação experimental, os scripts disponíveis são:

```sh
npm ci
npm run dev
npm run typecheck
npm run build
```

Leia cada comando como uma ação separada: `dev` mantém um servidor aberto; `typecheck` e `build` são verificações posteriores. Configurar Supabase e pagamentos é uma etapa independente, descrita no [guia](docs/OPERATING_SYSTEM.md#aplicação-experimental). Não use credenciais de produção em testes nem publique arquivos `.env`.

## Mapa do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Regras de trabalho e segurança |
| [`docs/OPERATING_SYSTEM.md`](docs/OPERATING_SYSTEM.md) | Guia atual de uso no VS Code |
| [`docs/WORKFLOW_VALIDATION.md`](docs/WORKFLOW_VALIDATION.md) | Evidências, testes e limites |
| [`docs/CHATGPT_HANDOFF.md`](docs/CHATGPT_HANDOFF.md) | Passagem de contexto e documentos históricos |
| [`TASKS.md`](TASKS.md) | Registro de tarefas do código experimental |
| [`docs/PRODUCT_FACTORY_LANDING_SPEC.md`](docs/PRODUCT_FACTORY_LANDING_SPEC.md) | Escopo e critérios da landing pública |
| [`landing/`](landing/) | Site estático, testes e instruções de execução |
| [`payments-sandbox/`](payments-sandbox/) | Laboratório Pix separado, guia e testes |
| [`src/`](src/) | Aplicação Next.js |
| [`supabase/`](supabase/) | Migrations e Edge Functions |
| [`scripts/`](scripts/) | Utilitários versionados |

Documentos de visão e handoffs antigos descrevem etapas anteriores. Para o fluxo diário, comece pelo guia atual. O experimento anterior do Studio está fora do fluxo operacional. A landing continua sendo a apresentação pública; a futura interface de trabalho tem escopo próprio na SPEC do Millennium.

## Princípios

Tarefas pequenas. Aprovação humana. Evidências verificáveis. Credenciais fora das conversas e do Git. Backup antes de reorganizar. Nenhuma promessa de execução ilimitada ou produto pronto apenas porque um agente respondeu.

[Segurança](docs/SECURITY.md) · [Gabriel Diniz](https://github.com/gabbswq)

