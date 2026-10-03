# Banco de homologacao do Millennium

Base SQL para a proxima etapa online. O painel local ainda usa `repository.mjs`
e JSON: esta migration nao roda no startup nem troca silenciosamente os dados
locais. Nao existe conexao com uma conta Supabase ou banco hospedado nesta entrega.

## Contrato

`001_accounts.sql` cria somente o schema `millennium_payments`. Pressupoe
`auth.users`, `auth.uid()` e os papeis `anon`, `authenticated` e `service_role`
do Supabase. Nao altere nem execute as migrations antigas de Stripe para testar
esta base. Aplicacao em banco externo exige projeto de homologacao definido,
revisao de privilegios e autorizacao; nao existe comando de deploy automatico.

| Tabela | Uso |
| --- | --- |
| `accounts` | Workspace de um usuario, nao conta bancaria ou onboarding de seller |
| `charges` | Pedido imutavel, centavos, idempotencia e estado reconciliado |
| `payment_events` | Recibos minimos e imutaveis, sem payload bruto ou credenciais |

O modelo inicial tem um dono por workspace. RLS deixa cada identidade consultar
apenas seus registros. O papel anonimo nao possui acesso; o autenticado nao pode
criar, editar, excluir ou marcar cobrancas como pagas. Colunas internas de
idempotencia e mapeamento do provedor nao sao concedidas ao papel autenticado.

`service_role` tem privilegios de backend e bypass de RLS. Portanto, **RLS nao
protege uma consulta administrativa que esquece a conta**. O adaptador futuro
deve verificar a identidade no servidor, resolver a conta autorizada e incluir
`account_id` em toda consulta de usuario. Nunca aceitar dono/conta confiavel do
corpo da requisicao; nunca entregar service key ao navegador ou app iOS.

`provider_account_ref` e uma referencia interna nao secreta da fonte Asaas, nao
uma API key, token de webhook nem ID do comprador. Pagamentos e eventos sao
unicos por provedor/ambiente/fonte, mesmo entre workspaces. O webhook deve
resolver a conta pela cobranca e fonte verificadas, nao por um dono enviado no
evento. Chave de idempotencia e hash de pedido incerto sao limitados por conta.
O ID do comprador ficticio fica congelado na cobranca para validar recebimento
mesmo se a configuracao do backend mudar. Nao e ID do dono/workspace/seller.

Eventos ligados a cobrancas usam FK composta para impedir referencias a outra
conta/fonte. Persistir evento e estado juntos, numa transacao com lock da
cobranca; comparar fingerprint antes de aceitar duplicata. Este contrato de
repositorio ainda precisa ser conectado ao servico e testado em concorrencia.

O schema bloqueia somente producao **nesta base de homologacao**. A arquitetura
final pode processar dinheiro real, mas requer ambiente e migracao separados,
novos limites e validacao operacional. A alteracao do CHECK nao e uma release.
Nao ha ledger de partidas dobradas, split, saque ou exclusao automatica do
historico financeiro. Retencao/anonimizacao exigem desenho e revisao proprios.

## Testar sem servico de banco instalado

Na raiz do repositorio:

```sh
npm --prefix payments-sandbox ci --ignore-scripts
npm --prefix payments-sandbox run test:database
```

Por padrao, a suite usa PostgreSQL em memoria via PGlite, apenas como ferramenta
de desenvolvimento. Nenhuma porta, arquivo de dados ou conta de nuvem e criado.
O navegador nao carrega PGlite e o bundle do painel nao recebe essas bibliotecas.

`tests/bootstrap.sql` e **exclusivo dos testes**. Define uma aproximacao minima
da identidade Supabase; nao valida JWTs, senha, passkey, login ou revogacao.
As duas identidades e lojas sao ficticias, sem documentos ou dados privados.

O CI repete a mesma suite em servidores PostgreSQL 17 e 18 efemeros. A variavel
`MILLENNIUM_TEST_DATABASE_URL` e exclusiva desse job: so admite loopback e banco
`millennium_test_*`. O teste recusa schemas existentes e nao usa DROP/RESET.
Nao aponte para banco pessoal, banco Supabase ou ambiente compartilhado.

Validacao local em 3 de outubro de 2026: 19 testes SQL passaram em PGlite.
`npm run pix:verify` tambem passou com 39 testes API e 12 de navegador. O
executor preservado passou seus 32 testes. JavaScript do painel: 12.111 bytes,
inalterado; as bibliotecas SQL sao dependencias de desenvolvimento.

## O que os testes nao comprovam

- Autenticacao Supabase real, emails, Face ID ou iOS.
- API multiusuario conectada a este schema.
- Concorrencia de varias instancias, pooling, backups e restauracao.
- Webhook Asaas realmente entregue ou Pix real/ficticio criado no provedor.
- Homologacao online, custo, latencia, disponibilidade ou requisitos de producao.

[SPEC de homologacao online](../../docs/PAYMENTS_ONLINE_SPEC.md).
Fontes: [RLS PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html),
[privilegios e RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PGlite para testes](https://pglite.dev/docs/).
