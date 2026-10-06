# Vercel: homologacao pessoal do Millennium

Checkpoint atualizado: 2026-10-06. Gabriel escolheu Vercel, sem contratar plano.
Fonte do deploy observado: develop 009d43a086d58c01c54a230618d0b99eaa6efa54.
Nenhuma release Git main/preview; hospedagem de teste ainda nao homologada.

## Estado verificado

- Conexao Vercel do app respondeu: usuario gabbswq, plano hobby.
- Projeto millennium-test criado pela API nativa autenticada, sem extrair
  token ou depender do login CLI. ID prj_mFFhIx2CM3D4ErZzmcNlpKjBLCxv.
- Consulta atual: framework nextjs, Node 24.x, live=false e SSO enabled
  prod_deployment_urls_and_all_previews. Esses campos nao provam runtime,
  configuracao de build/limites ou protecao de cada dominio em HTTP.
- list_teams retornou vazio. O accountId retornado pelo projeto nao permitiu
  comprovar plano de equipe; somente o plano hobby do usuario foi confirmado.
- Deploy dpl_9bCmPALnDygWXMx6ZvvK39GcoDi3 terminou READY a partir da revisao
  acima. Retornou target=production apesar de solicitado target=preview.
  Nao considerar READY uma homologacao de Auth/Stripe nem uma release autorizada.
- Cancelamento retornou INVALID_ARGUMENT; nao houve confirmacao de cancelamento.
  Pausa do projeto foi aceita pelo provedor. Em 6 de outubro, duas consultas
  HTTPS anonimas, sem bypass/redirecionamento, confirmaram status 503 e
  DEPLOYMENT_PAUSED no dominio millennium-test.vercel.app e no URL unico
  millennium-test-86gqpcwzk-gabbswqs-projects.vercel.app. Manter pausado.

Historico do CLI antes da criacao por API:

- CLI oficial 62.2.0 preparado no cache test-results/npm-cache; ignore-scripts,
  sem instalacao global nem dependencia adicionada ao Millennium.
- npm confirmou pacote do repositorio vercel/vercel e integridade de distribuicao.
- vercel --version executado. whoami, com telemetria desativada, retornou
  Logged out; esse ensaio CLI nao criou login, token, .env ou deploy.
- A permissao adicional de whoami foi apenas para pastas de configuracao do
  CLI no perfil Windows. O sandbox inicialmente bloqueou esses mkdirs; nenhuma
  credencial da conexao do app foi extraida para contornar o login.

## Plano e limites

[Hobby](https://vercel.com/docs/plans/hobby) e gratuito e restrito a uso pessoal
nao comercial. O ensaio atual deve permanecer pessoal, sem clientes/repasses
reais. Uso comercial exigira rever hospedagem/plano com autorizacao separada.
Exceder quotas pode suspender recursos; nao prometer disponibilidade ilimitada.
Spend Management nao esta disponivel no Hobby. Nao contratar add-ons/trial Pro.

Deployment Protection e [Vercel Authentication](https://vercel.com/docs/deployment-protection)
devem ser conferidos antes de publicar o preview. Nao desativar protecao geral
para receber webhooks: planejar excecao de rota controlada, mantendo assinatura
e limites, sem colocar bypass secret em URL publica.

## Proximo passo humano

Gabriel confirmou que ainda precisa configurar a conta Stripe. Concluir
registro/login/MFA no Dashboard oficial e abrir um Sandbox. Nao enviar chaves,
documentos, senhas, codigos ou tokens no chat; nao ativar pagamentos reais.
Ver [guia de chaves TEST](STRIPE_TEST_KEYS.md). Configurar campos privados
somente apos aprovar o ambiente de homologacao; Checkout/Connect desligados.

## CLI opcional

A conexao nativa do app ja criou o projeto sem login CLI. Este procedimento
continua opcional para operacao pelo terminal; nao e prova de deploy concluido.

No PowerShell, na pasta do Millennium, autenticar o CLI pela pagina oficial:

```powershell
& 'C:/Program Files/nodejs/npx.cmd' --yes --ignore-scripts --package=vercel@62.2.0 --cache test-results/npm-cache -- vercel login
```

O executavel npx.cmd existe nesta maquina. Login nao foi executado pelo agente;
o sucesso dessa etapa ainda precisa ser confirmado com whoami. Nao enviar
senha, codigo de MFA, link de dispositivo ou token na conversa.

## Gates para continuar

1. Reusar o projeto millennium-test e conferir escopo/protecao; manter Hobby.
2. Corrigir o alvo antes de publicar outro ensaio. A [API oficial](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
   documenta omitir target para Preview; a resposta target=null indica Preview.
   Nao passar preview como string nem assumir sucesso sem ler a resposta.
   Nao despausar o deployment production anterior para acomodar o conector.
   Usar Next.js na raiz, sem
   publicar a landing legada ou usar main como fonte por conveniencia.
3. Construir/deployar somente codigo verificado de develop/feature; ambiente
   preview Vercel nao significa promover a branch Git preview.
4. Conferir protecao, HTTPS, quotas/uso e regras disponiveis antes de expor APIs.
5. Gabriel configura secrets TEST nos campos seguros dos provedores; agente
   nao edita .env/chaves. Verificar presenca de nomes, nunca valores/logs.
6. Configurar origem/callbacks Auth e webhook TEST para dominio aprovado;
   nao criar outro banco nem replay de migrations no Supabase existente.
7. Ensaio Auth/CAPTCHA server-side, isolamento entre dois donos, Checkout/webhook
   TEST e falhas ambiguias; nada real nem aprovacao local de KYC.

O helper create_git_project do conector exige teamId e usa a production branch
do repositorio. Nao inventar teamId, extrair token ou publicar main para
acomodar o helper. A conexao do app nao autentica automaticamente o CLI.

Ainda nao existe URL de homologacao funcional comprovada. Os onze alertas SAST
foram corrigidos na ref develop; dependencias dev, patch PostgreSQL remoto,
Auth/Stripe externos e limites distribuidos seguem gates de seguranca.
Ver [programa](SECURITY_PROGRAM.md) e [baseline](SECURITY_SCAN_BASELINE.md).
