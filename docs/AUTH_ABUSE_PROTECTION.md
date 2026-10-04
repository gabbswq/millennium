# Millennium: protecao de autenticacao contra abuso

Integracao opt-in do Cloudflare Turnstile para login com senha, cadastro,
recuperacao e reenvio de confirmacao pelo Supabase Auth. Nao configura uma
conta externa, nao altera .env e nao garante limite financeiro ou imunidade
a bots. Vendedores/Connect e Checkout continuam separados e test-only.

## Configuracao por canal seguro

| Variavel publica do app | Valor |
| --- | --- |
| NEXT_PUBLIC_AUTH_CAPTCHA_ENABLED | true para exigir o desafio; ausente ou false preserva o fluxo anterior |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Somente a site key publica do widget aprovado |

Flag desconhecida ou true sem uma site key valida bloqueia os formularios.
Variaveis NEXT_PUBLIC_ sao incorporadas ao build: reconstruir o app apos
mudar a configuracao. O segredo privado do Turnstile pertence exclusivamente
ao painel de Auth do Supabase, nunca a NEXT_PUBLIC_, Git, logs ou chat.

1. Aprovar dominio HTTPS, plano e teto financeiro antes de provisionar.
2. Criar um widget Turnstile Managed com hostnames restritos ao ambiente
   autorizado. Nao usar as chaves ficticias da suite de testes na nuvem.
3. Configurar as duas variaveis publicas no ambiente de homologacao aprovado,
   reconstruir e conferir o widget. Nao ativar enforcement com clientes antigos.
4. Ativar CAPTCHA no Supabase Auth, selecionar Turnstile e cadastrar o segredo
   exclusivamente no painel seguro. O Supabase valida os tokens recebidos.
5. Testar login, cadastro, recuperacao e reenvio reais. Chamada direta ao Auth
   sem token, com token expirado ou reutilizado deve ser recusada pelo provedor.
6. Conferir rate limits de Auth, quotas, alertas e regras de borda do host
   antes da invocacao. Google OAuth nao usa o token deste formulario; validar
   separadamente os controles do provedor e das rotas de callback/sync.

Desabilitar apenas a flag do frontend nao desabilita a exigencia no Supabase.
Para rollback autorizado, coordenar configuracao do backend e build anterior,
sem abrir uma janela publica desprotegida. Nao fazer esse rollback em producao
como correcao automatica de uma indisponibilidade do CAPTCHA.

## Comportamento do app

- Carrega diretamente o SDK oficial, somente nos formularios habilitados.
- Usa tamanho compacto quando o container tem menos de 300 px; nao escala
  ou distorce o widget. Resize e navegacao limpam a instancia anterior.
- Token fica apenas em memoria e e consumido antes de cada tentativa. Expiracao,
  erro ou falha de configuracao bloqueiam o envio; falta de token tambem e
  recusada no caminho de submissao, nao apenas no botao desabilitado.
- Reset apos resposta exige um desafio novo, inclusive apos credenciais erradas
  ou falha de envio. Falha do SDK nao dispara tentativas infinitas: recarregar
  a pagina apos resolver rede, bloqueador ou configuracao do provedor.
- Reenvio recusado nao exibe sucesso. API aceitar um envio nao comprova entrega
  na caixa de entrada. Recuperacao mantem mensagem sem enumerar usuarios.

O guard no cliente melhora o fluxo; um atacante pode ignora-lo. Enforcement
no Supabase e obrigatorio para protecao contra chamadas diretas. CAPTCHA nao
limita trafego/compute por si so, e rate limiting local nao e distribuido.
Manter Free nao garante disponibilidade sob abuso. Nao alterar planos pagos,
quotas ou custos sem autorizacao humana.

## Verificacao reproduzivel

```sh
npm run test:payments
npm run test:auth:captcha:e2e
```

A suite de CAPTCHA usa portas 4315/4316, navegador desktop/mobile e um SDK
ficticio servido apenas por Playwright; o fixture Auth e loopback descartavel.
Nao enviar credenciais reais. Stripe fica desativada. Rodar separadamente da
suite payments:e2e (4313/4314), pois ambas usam .next-e2e. Artefatos ficam em
test-results/auth-captcha, ignorados pelo Git. Esses testes comprovam o
contrato do app, nao validacao real do Cloudflare/Supabase nem resistencia
a ataque externo. Confirmar esses gates antes de anunciar protecao online.

Referencias primarias:
[CAPTCHA no Supabase](https://supabase.com/docs/guides/auth/auth-captcha),
[configuracao do widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/),
[controle de custos Supabase](https://supabase.com/docs/guides/platform/cost-control).
