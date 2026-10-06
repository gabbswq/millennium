# Stripe: chaves restritas de teste

Checkpoint: 2026-10-06 (America/Sao_Paulo). Feature stripe-test-key-policy,
base develop 009d43a086d58c01c54a230618d0b99eaa6efa54.
Gabriel ainda precisa preparar sua conta Sandbox. Nao habilitar pagamentos
reais nem criar/ler credenciais no fluxo do agente.

## Contrato do codigo

- STRIPE_SECRET_KEY aceita sk_test_ e rk_test_, somente no servidor.
- Uma policy pura e compartilhada pelo aplicativo e pelo comando de recuperacao.
- Flags Checkout/Connect continuam desligadas ate configuracao autorizada.
- Chaves live, publishable, organizacionais, webhook ou malformadas sao recusadas.
- Timeouts de 10 segundos e zero retries Stripe permanecem inalterados.
- Livemode, preco, valor, moeda, pedido, assinatura e dedup continuam conferidos.
- Prefixo valido nao comprova autenticidade, permissao ou homologacao remota.

Chaves restritas sao substitutas de chaves amplas no SDK, mas precisam de
permissoes explicitas. Nao imprimir chave, Authorization ou erro bruto de
provedor; nao enviar valores por chat/Git, argumentos CLI ou campos publicos.

## Preparacao humana

1. Registrar conta pelo Dashboard oficial, concluir login/MFA e abrir um Sandbox.
2. Criar uma chave restrita TEST para este servico, com recursos desnecessarios
   em None. Nao criar rk_live_ nem ativar a conta financeira para este ensaio.
3. Conferir o inventario de chamadas abaixo e as permissoes/dependencias que
   o Dashboard exigir. Ainda nao existe configuracao de permissoes homologada.
4. Inserir a chave exclusivamente no campo privado do servidor da Vercel
   para o ambiente de ensaio aprovado. Nao ativar Checkout/Connect agora.
5. Validar as chamadas no Sandbox e revisar logs redigidos. Permissao negada
   exige revisar o recurso faltante, nao habilitar todas as permissoes.

## Inventario atual, nao permissoes remotas comprovadas

| Uso | Chamada SDK | Acesso a revisar |
| --- | --- | --- |
| Checkout | prices.retrieve | Prices: leitura |
| Checkout | checkout.sessions.create | Checkout Sessions: escrita e dependencias requeridas |
| Recuperacao | checkout.sessions.retrieve com expand line_items | Checkout Sessions e recursos expandidos: leitura |
| Vendedores, opcional e desligado | accounts.retrieve/create | Accounts: leitura/escrita |
| Vendedores, opcional e desligado | accountLinks.create | Account Links: escrita |
| Webhooks | constructEvent | Verificacao local com segredo de endpoint separado, nao uma API de rede |

Catalogo Product/Price de teste e endpoint webhook continuam exigindo setup
autorizado no Dashboard. Recuperacao somente inspeciona por padrao; bind-open
usa privilegio separado do banco, nao cria sessao Stripe nem marca paid.
Vendedores nao sao necessarios para homologar o Checkout de comprador.

## Validacao deste incremento

Suite focada cobre ambas as formas TEST, limites de tamanho, formas recusadas,
zero requisicoes para chave invalida e transporte oficial interceptado com
chave restrita ficticia. Nenhuma chave autentica ou chamada externa Stripe.
Estado integrado e totais ficam no [handoff](HANDOFF_MILLENNIUM.md).

O primeiro CI encontrou a dependencia existente source-map-js 1.2.1,
vulneravel a DoS em source maps indexados. A atualizacao pontual para 1.2.2
nos lockfiles raiz e landing usa a integridade publicada no registro oficial.
Nenhuma dependencia nova ou upgrade amplo; o gate de audit continua ativo.
Ver [advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) e
[release oficial](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).

Ainda faltam login/JWT real, CAPTCHA server-side, dois donos, catalogo TEST,
Checkout/webhook externos e controles da hospedagem. A Vercel permanece
pausada ate corrigir o alvo e preparar a homologacao, sem contrato/plano pago.

Fontes: [Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys),
[segredos](https://docs.stripe.com/keys-best-practices) e
[setup do Millennium](STRIPE_CHECKOUT_SETUP.md).
