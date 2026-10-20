# SPEC: Próximas etapas do Millennium

Data: 20 de outubro de 2026
Status: plano de execução por etapas; nenhuma etapa deste documento foi iniciada.

## Objetivo

Preservar no GitHub as evidências atualizadas de autenticação, conferir como o
trabalho se relaciona com o PR existente e deixar um próximo incremento claro.
Cada etapa termina com evidência verificável e pode ser retomada sem reexecutar
as anteriores.

## Estado de partida conhecido

- Branch local: `feature/stripe-supabase-test-homologation`.
- A autenticação Google no Preview foi confirmada manualmente pelo usuário com
  duas contas diferentes, incluindo logout e nova entrada.
- Email/senha e a tentativa de abrir uma rota protegida após logout não foram
  confirmados nesse teste humano.
- O Checkout exibido no Preview informa que ainda não está configurado e que
  nenhuma cobrança será criada.
- Há alterações locais intencionais em `docs/AUTH_GOOGLE_SETUP.md` e
  `docs/HANDOFF_MILLENNIUM.md`. Devem ser revisadas e preservadas.
- A documentação anterior contém alguns estados antigos. Atualizar somente o
  que contradiz evidência atual, sem reescrever o histórico.
- `.env.local` existe, mas não deve ser lido, exibido ou alterado. Nenhum segredo
  pode entrar no Git.

Este estado deve ser conferido novamente no início de cada etapa; o texto acima
é contexto, não substitui `git status`, diff ou consulta ao PR.

## Plano de execução

### Etapa 1: revisar e guardar a evidência de autenticação

1. Ler `AGENTS.md`; conferir branch, status, diff e histórico recente.
2. Conferir se existe PR aberto ou já integrado para esta branch e qual é seu
   destino. Não abrir um PR duplicado.
3. Revisar os dois documentos de autenticação e confirmar que descrevem apenas
   o que foi observado. Preservar distinção entre confirmação humana e testes
   automatizados.
4. Rodar `git diff --check` e verificar os arquivos que serão incluídos. Não
   incluir `.env*`, `.vscode/settings.json` ou arquivos de outra tarefa.
5. Criar um commit semântico apenas com os dois documentos de autenticação e
   esta SPEC, se forem os arquivos da tarefa, e enviar à branch de trabalho.
   Não fazer push para `main`, merge ou deploy.

**Aceite:** commit identificado na branch de trabalho, push confirmado pelo
servidor e `git status` sem alterações inesperadas. Se houver conflito ou
arquivo adicional, parar e registrar o bloqueio sem descartar nada.

### Etapa 2: conferir o PR contra `develop`

1. Comparar a branch de trabalho com `develop` e verificar o PR existente.
2. Se o PR que entregou o código de autenticação já foi integrado, abrir ou
   atualizar um PR pequeno contendo somente o checkpoint documental, se ainda
   houver diferença a integrar.
3. Se já existir PR aberto adequado, atualizar esse PR em vez de criar outro.
4. Revisar diff, arquivos e verificações do CI. Pedir revisão humana antes de
   integrar.

**Aceite:** URL do PR correto, base `develop`, diff esperado e verificações
visíveis. Merge fica para uma autorização explícita posterior.

### Etapa 3: validar email e senha no Preview

1. Confirmar que o Preview aprovado continua acessível e que a configuração
   aponta para o projeto Supabase esperado, sem ler valores secretos.
2. Com o usuário, testar cadastro/login por email e senha usando uma conta de
   teste controlada por ele. O usuário digita as próprias credenciais no site.
3. Observar confirmação de email exigida pelo Supabase, sessão no painel,
   logout e bloqueio de `/dashboard` após sair.
4. Registrar resultado, ambiente, horário e limitações sem salvar email,
   senha, token, código OAuth ou URL transitória com `code`.

**Aceite:** sequência real documentada com sucesso ou falha reproduzível e
próxima ação específica. Testes com fixtures não substituem esse aceite.

### Etapa 4: decidir e validar o próximo incremento de Checkout

1. Inspecionar o fluxo Stripe já existente e a SPEC vigente antes de propor
   mudanças. Separar Checkout de compras próprias do cadastro de vendedores.
2. Listar o que está implementado, desativado por configuração, pendente de
   painel externo e coberto apenas por testes.
3. Escolher um único cenário de teste em sandbox e seus critérios antes de
   alterar código ou chaves. Nunca habilitar chaves live ou cobrança real.
4. Implementar e validar apenas esse cenário, com os testes de domínio/SQL,
   lint, typecheck e build exigidos pelo repositório.
5. Atualizar a SPEC e a passagem de turno com evidência, sem afirmar que uma
   cobrança real ocorreu quando apenas fixtures ou sandbox foram usados.

**Aceite:** comportamento de teste reproduzível, sem dinheiro real, dados de
outra conta ou alegação maior que as evidências.

### Etapa 5: planejar Produção separadamente

Só depois dos aceites anteriores, preparar uma lista de configuração e critérios
para Production: domínio canônico, URLs OAuth permitidas, variáveis da Vercel,
build, observabilidade, reversão e revisão de segurança. A lista é uma proposta;
alterar DNS, variáveis remotas, branch `main` ou fazer deploy exige pedido
específico do usuário.

## Regras entre etapas

- Executar somente uma etapa por vez e conferir novamente branch/status antes da
  próxima.
- Falha de teste ou configuração externa pausa apenas a etapa dependente;
  registrar evidência e uma ação curta para o usuário quando necessário.
- Não repetir verificações aprovadas sem mudança de código/configuração ou uma
  dúvida concreta.
- `Google OAuth no Preview confirmado pelo usuário` é validação humana. Suites
  locais anteriores são evidência automatizada/fixture, não autenticação real.
- PR pode ser preparado para revisão; merge, Production e deploy permanecem
  decisões separadas.

## Prompt para iniciar a Etapa 1

```text
Continue o Millennium conforme docs/SPEC_CONTINUACAO_AUTH_E_CHECKOUT.md e execute somente a Etapa 1. Leia AGENTS.md; confira branch, git status, diffs e PR existente antes de editar. Preserve todo o trabalho local, especialmente docs/AUTH_GOOGLE_SETUP.md, docs/HANDOFF_MILLENNIUM.md, esta SPEC e .vscode/settings.json. Não leia nem exiba .env.local ou qualquer segredo. Revise as evidências do OAuth com precisão, rode git diff --check e inclua no checkpoint somente docs/AUTH_GOOGLE_SETUP.md, docs/HANDOFF_MILLENNIUM.md e docs/SPEC_CONTINUACAO_AUTH_E_CHECKOUT.md, desde que a revisão confirme que esses são os arquivos desta tarefa. Faça commit semântico e push somente para a branch de trabalho, conforme minha autorização de checkpoint para o Millennium. Não faça merge, deploy nem push para main. Confirme branch, hash do commit, resultado do push e status final. Se o diff incluir arquivo inesperado, houver conflito, ou o estado do PR mudar o escopo, preserve tudo e pare antes de commit/push, explicando em linguagem simples.
```
