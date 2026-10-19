# SPEC: Acesso ao Millennium

## Objetivo

Entregar uma entrada simples e confiavel para o app: login por email/senha,
criacao de conta e login Google, com sessao Supabase em cookies no Next.js.
Checkout, Stripe, KYC e publicacao na Vercel nao fazem parte desta entrega.

## Experiencia

- Tela de login responsiva, acessivel por teclado e consistente com a marca.
- Entrar com Google ou email/senha; permitir mostrar/ocultar a senha.
- Exibir erros em portugues, estados de carregamento e caminho de cadastro e
  recuperacao de senha.
- Preservar um destino interno solicitado no inicio do OAuth; nunca aceitar
  redirecionamento para outro dominio.

## Seguranca e limites

- Supabase Auth e responsavel pela verificacao de credenciais e sessao; o app
  nao guarda senha em tabela propria nem implementa criptografia caseira.
- OAuth Google usa authorization-code/PKCE e callback existente
  `/auth/callback`, que troca o codigo por sessao no servidor.
- Solicitar somente perfil basico: `openid`, email e profile.
- O client secret Google fica apenas na configuracao segura do Supabase. Nunca
  em `NEXT_PUBLIC_*`, `.env` versionado, log, codigo ou conversa.
- Login Google so e considerado operacional depois de consentimento e callback
  reais completados em ambiente autorizado.
- Nenhuma mudanca em dados financeiros, Checkout, Stripe, plano ou deploy.

## Criterios de aceite

1. `/auth/login` rende em desktop e mobile, sem overflow horizontal, e tem
   labels, foco visivel, mensagens de erro e estados de envio.
2. O schema valida email e senha antes da chamada ao Supabase.
3. Senha incorreta nao cria sessao; credenciais nao aparecem em URL ou log.
4. OAuth conserva somente caminho local permitido e conclui PKCE no callback.
5. Testes automatizados, lint, typecheck e build passam.
6. Um humano conclui login com Google e por email em ambiente de teste, confirma
   email/retorno e consegue sair e entrar novamente. Esse passo nao pode ser
   substituido por HTTP 200 ou por teste de renderizacao.

## Dependencias externas restantes

- Criar OAuth Client do tipo Web no Google Auth Platform.
- Habilitar Google em Supabase Auth e cadastrar Client ID/Secret pelo painel.
- Autorizar no Google o callback exibido pelo provedor Google do Supabase.
- Incluir o callback do app local na allow-list do Supabase. Adicionar dominio
  de Preview/produccion somente quando for autorizado e estiver acessivel.

Passo a passo: [AUTH_GOOGLE_SETUP.md](AUTH_GOOGLE_SETUP.md).
