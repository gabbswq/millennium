# Configurar login Google

O codigo do Millennium usa Supabase Auth com `signInWithOAuth('google')`,
retorno em `/auth/callback` e troca PKCE pelo cliente server-side. O segredo do
Google nao e necessario no navegador; e guardado no provedor do Supabase.

## Conectar o app local ao Supabase

1. Na raiz do repo, crie `.env.local` (esse arquivo e ignorado pelo Git).
2. No painel Supabase, abra **Project Settings > API Keys** e copie a URL do
   projeto e a chave **Publishable**. A chave legada `anon` tambem e publica e
   aceita pelo codigo atual.
3. Coloque somente estes valores em `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
   ```

   O nome da variavel `ANON_KEY` e mantido por compatibilidade; ela pode conter
   a chave Publishable moderna. Nunca use `service_role`, `sb_secret_...` ou
   outro segredo em uma variavel `NEXT_PUBLIC_*`. Nao cole os valores no chat,
   em prints ou em arquivos versionados.
4. Pare e reinicie `npm run dev` para carregar as variaveis. O aviso de ambiente
   desconectado deve sumir e os botoes de login devem habilitar.

## Google Cloud

1. Abra [Google Auth Platform](https://console.cloud.google.com/auth/overview)
   e selecione/crie um projeto.
2. Configure a tela de consentimento e o publico. Enquanto estiver em modo de
   teste, adicione somente as contas que vao validar o login como test users.
3. Em Clients, crie credenciais OAuth do tipo **Web application**.
4. Em **Authorized JavaScript origins**, adicione a origem usada pelo app
   local, hoje `http://127.0.0.1:4313`. Nao adicione caminhos nessa lista.
5. Em **Authorized redirect URIs**, use a URL de callback que o painel do
   Supabase exibe em Auth > Providers > Google. Para o projeto atual, a forma
   costuma ser `https://pywotovmlxzwwpawpaew.supabase.co/auth/v1/callback`;
   confirme o valor mostrado no painel antes de salvar.
6. Copie Client ID e Client Secret para o passo seguinte, sem colar em chat,
   terminal compartilhado, arquivo do app ou variavel `NEXT_PUBLIC_*`.

## Supabase

1. No projeto do Millennium, acesse Auth > Sign In / Providers > Google.
2. Ative Google e informe Client ID e Client Secret nos campos do painel.
3. Em Auth > URL Configuration, adicione a URL de retorno do app local:
   `http://127.0.0.1:4313/auth/callback`.
4. Configure somente os escopos basicos exigidos pelo provedor: `openid`,
   email e profile. Nao solicite acesso a Gmail, Drive ou Calendar para login.
5. Salve e volte ao app local. Nao e necessario colocar o Client Secret no
   `.env` do Next.js.

## Validacao acompanhada

1. Abra `http://127.0.0.1:4313/auth/login` e escolha Continuar com Google.
2. Confirme que o dominio exibido e o do Google e aprove o acesso minimo.
3. Confirme que o navegador retorna para `/auth/callback` e depois para o
   Millennium autenticado. Teste tambem sair, voltar ao login e entrar de novo.
4. Se aparecer `redirect_uri_mismatch`, compare exatamente a URI do erro com
   a lista Google. Se Supabase informar redirect nao autorizado, confira a
   URL Configuration do Supabase.

## Depois do teste local

Vercel/Preview segue pendente de autorizacao e credenciais do runtime. Quando
um dominio de teste aprovado estiver acessivel, adicionar a origem em Google
Cloud e o callback exato em Supabase Auth. Nao use wildcard amplo em producao.
Nao habilite pagamentos reais nesta validacao.

## Referencias oficiais

- [Supabase: Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google: OAuth 2.0](https://developers.google.com/identity/protocols/oauth2/)

## Estado desta configuracao, 19 de outubro de 2026

Conforme confirmado pelo usuario durante a configuracao guiada:

- O projeto Google esta no modo Externo/Teste e o email de teste foi adicionado.
- Foi criado um cliente OAuth do tipo Web. O segredo inicialmente exposto foi
  redefinido; o novo valor foi salvo diretamente no provedor Google do Supabase.
- O provedor Google foi ativado no Supabase. `Skip nonce checks` e `Allow users
  without an email` permaneceram desativados.
- A origem local autorizada no Google e `http://127.0.0.1:4313`, e a URI de
  redirecionamento e a callback exibida pelo provedor Google do Supabase.
- No Supabase, Site URL foi definida como `http://127.0.0.1:4313` e a allow-list
  inclui `http://127.0.0.1:4313/auth/callback`.

Esses passos foram confirmados pelo usuario e por capturas do painel.

### Configuracao local e validacao

O usuario criou `.env.local` na raiz do checkout com as variaveis
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A verificacao
local confirmou que a URL corresponde ao projeto e que a chave tem o prefixo
`sb_publishable_`; os valores nao foram exibidos nem adicionados ao Git. O
arquivo e ignorado por `.gitignore`.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://pywotovmlxzwwpawpaew.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave-publica-do-projeto>
```

O build inicialmente encontrou `cookies()` chamado fora de um request em
`generateStaticParams` de `src/app/articles/[slug]/page.tsx`. A consulta de
slugs publicos agora usa um cliente Supabase sem cookies; as consultas das
paginas por request continuam no cliente SSR. Com isso, `npm run build`
concluiu e gerou as 20 rotas.

Checks locais nesta retomada: `npm run test:payments` (77/77),
`npm run typecheck`, ESLint do arquivo corrigido e `npm run build` passaram.
O lint completo ficou sem resultado apos demora e foi interrompido; lint do
arquivo alterado passou. A tentativa de consultar `/auth/v1/settings` pela
ferramenta de terminal foi bloqueada pela rede do ambiente.

O Next serviu `/auth/login` com HTTP 200 e o navegador mostrou a tela. O clique
em “Continuar com Google” chegou a `accounts.google.com` na selecao de conta.
Foi observado o retorno autorizado ao callback Supabase e o `redirect_to`
local `/auth/callback?next=%2Fdashboard`, com escopos email/perfil. Nenhuma
conta foi escolhida e nenhuma permissao foi concedida. Portanto, o inicio do
OAuth e a configuracao de redirect foram validados, mas consentimento, callback
PKCE, sessao, logout/relogin e login por email continuam pendentes.

### Proximo passo manual

Na tela de selecao do Google ja aberta, escolha voce mesmo a conta que adicionou
como usuaria de teste e revise os dados solicitados antes de aprovar. Depois
confirme retorno ao Millennium, saia e entre novamente. Nao compartilhe
credenciais, codigos ou chaves. Se surgir erro, anote apenas a mensagem sem
dados pessoais ou tokens.

Se o `.env.local` precisar ser criado novamente, use apenas a URL e a chave
publica Publishable (ou a chave publica legada `anon`):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://pywotovmlxzwwpawpaew.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave-publica-do-projeto>
```

Copie a chave em Project Settings > API Keys. Nunca use `service_role`,
`sb_secret_...` ou o Client Secret do Google nesse arquivo. Reinicie o servidor,
abra `/auth/login` em `http://127.0.0.1:4313`, conclua o consentimento com a
conta de teste e confirme callback, sessao, logout e novo login. Ate esse teste,
trate OAuth como configurado no painel, mas ainda nao validado ponta a ponta.

### Atualizacao apos login local e checkpoint GitHub, 19 de outubro de 2026

O usuario concluiu a etapa Google e enviou captura da pagina
`/dashboard/checkout` aberta em `http://127.0.0.1:4313`, com sessao autenticada.
Isso confirma visualmente o retorno local ao painel. Logout, relogin, login por
email e Google OAuth no dominio Vercel ainda nao foram testados.

Na worktree Windows, `npm run test:payments` passou (77/77), `npm run typecheck`,
`npm run lint` e `npm run build` passaram. O build gerou 20 rotas. No WSL, a
suite falhou antes de executar testes porque a pasta `node_modules` compartilhada
tem o binario Windows do esbuild; nao reinstale dependencias nessa pasta.

O checkpoint `73286e4c` esta na branch
`feature/stripe-supabase-test-homologation` no GitHub. O push iniciou um Preview
Vercel para essa branch; na ultima consulta o estado ainda era `BUILDING`. A
chave `NEXT_PUBLIC_SUPABASE_ANON_KEY` nao esta configurada para Preview. A
tentativa de grava-la pela integracao Vercel foi rejeitada, sem alteracao.

### Proximo passo para Preview

No Vercel, abra o projeto `millennium-test` > **Settings > Environment Variables**
e adicione `NEXT_PUBLIC_SUPABASE_ANON_KEY` no alvo **Preview**, usando o valor
`sb_publishable_...` ja salvo localmente em `.env.local`. Nao use uma chave
`sb_secret_...` ou `service_role`, e nao cole o valor no chat. Depois, confirme
que o deployment Preview ficou `READY`. Para login Google no dominio de Preview,
adicione a origem HTTPS do deployment em Google Cloud > Authorized JavaScript
origins e inclua `https://<dominio-preview>/auth/callback` na allow-list do
Supabase. O redirect URI do cliente Google continua sendo a callback do
Supabase, nao a rota do app. Checkout e Stripe permanecem desativados.
