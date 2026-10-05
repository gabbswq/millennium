# Vercel: homologacao pessoal do Millennium

Checkpoint: 2026-10-05. Gabriel escolheu Vercel, sem contratar plano agora.
Base testada: develop 34354a028c29d0baeb4c07d7bd4e3c36c05820fb.
Feature de preparacao: vercel-homologation; nenhuma release main/preview.

## Estado verificado

- Conexao Vercel do app respondeu: usuario gabbswq, plano hobby.
- list_teams retornou vazio; busca de projeto millennium retornou vazio.
  Isso nao prova ausencia de outros projetos/recursos na conta.
- CLI oficial 62.2.0 preparado no cache test-results/npm-cache; ignore-scripts,
  sem instalacao global nem dependencia adicionada ao Millennium.
- npm confirmou pacote do repositorio vercel/vercel e integridade de distribuicao.
- vercel --version executado. whoami, com telemetria desativada, retornou
  Logged out; nenhum login, token, .env ou deploy foi criado.
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

## Passo humano necessario

No PowerShell, na pasta do Millennium, autenticar o CLI pela pagina oficial:

```powershell
& 'C:/Program Files/nodejs/npx.cmd' --yes --ignore-scripts --package=vercel@62.2.0 --cache test-results/npm-cache -- vercel login
```

O executavel npx.cmd existe nesta maquina. Login nao foi executado pelo agente;
o sucesso dessa etapa ainda precisa ser confirmado com whoami. Nao enviar
senha, codigo de MFA, link de dispositivo ou token na conversa.

## Gates para continuar

1. Confirmar whoami e escopo correto apos login humano; manter Hobby.
2. Criar/reusar um projeto de ensaio protegido do Next.js na raiz, sem
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

Ainda nao existe URL de homologacao comprovada. Patch PostgreSQL remoto,
alertas SAST/dependencias e limites distribuidos seguem gates de seguranca.
Ver [programa](SECURITY_PROGRAM.md) e [baseline](SECURITY_SCAN_BASELINE.md).
