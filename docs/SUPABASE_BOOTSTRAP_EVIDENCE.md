# Millennium: schema remoto autorizado

Projeto pywotovmlxzwwpawpaew, regiao sa-east-1, organizacao gabbswq.
Aplicacao e consultas em 4 de outubro de 2026, aproximadamente 14:58-15:06 UTC.
Gabriel autorizou criar tabelas/permissoes, sem mudar plano ou habilitar dinheiro
real. Plano Free confirmado antes e depois. Nenhuma credencial foi consultada,
editada ou publicada; nenhum endpoint Stripe, Auth ou hospedagem foi ativado.

## O que foi aplicado

As dez migrations anteriores, sem modificar seus arquivos, mais:

- 20261004123048_content_privileges_hardening.sql: grants explicitos no conteudo,
  sem TRUNCATE/TRIGGER/REFERENCES/MAINTAIN para clientes; helpers com search_path
  fixo; unaccent em extensions; futuros objetos postgres exigem grants explicitos.
- 20261004150302_private_featured_snapshot.sql: snapshot featured_articles
  exclusivo do servidor. Navegadores usam a view invoker public_articles, que
  aplica a visibilidade atual. O snapshot nao garante retirada imediata de artigos.

18 tabelas public criadas, todas pertencentes a postgres e com RLS habilitado.
As quatro tabelas Stripe novas tambem tem FORCE RLS. Tres views normais possuem
security_invoker=true. Checkout/Vendedores continuam separados e test-only.
Nenhum usuario, produto, preco, vendedor ou pedido foi deixado como seed remoto.
Jobs de publicacao, webhooks, assinaturas e comissoes nao foram habilitados.

## Transacao e historico

Preflight remoto: nenhuma tabela/view/funcao de aplicacao, usuario Auth, bucket
ou trigger Auth customizado. O bootstrap verificou novamente esse inventario
na transacao e usou advisory lock, lock_timeout 4s e statement_timeout 30s.

Os SQL foram separados pelo parser oficial do CLI, nao por split em ponto e
virgula. Apenas BEGIN/COMMIT externos das migrations foram retirados do pacote;
corpos, ordem e arquivos permaneceram intactos. As 11 primeiras migrations
foram aplicadas juntas, incluindo o hardening, sem publicar permissoes legadas
entre etapas. A segunda migration nova restringiu o snapshot depois do advisor.

A primeira tentativa do bootstrap abortou numa verificacao de grants que
concatenava nomes antes do filtro de schema. Inventario confirmou rollback:
zero tabelas/triggers/unaccent e historico vazio. Verificacao corrigida para
OIDs reais; segunda tentativa concluida. Nao foi repetida DDL sobre base parcial.

MCP apply_migration gera timestamp novo, nao preserva versao local. Foi usado
o SQL de repair do CLI oficial (UPSERT_MIGRATION_VERSION e
DELETE_MIGRATION_VERSION), via execute_sql, com nomes/versoes/statements locais,
depois de verificar schema aplicado e o unico registro esperado do bootstrap.
Nao foi executado o binario migration repair nem foram inventados registros de
migrations ainda nao aplicadas. Transacoes guardadas reconciliaram somente os
registros temporarios 20261004145816 e 20261004150430, preservando as 12 versoes
originais e o conteudo completo de cada arquivo dividido em statements.

Referencia fixada em
[Supabase CLI 3cb948c5](https://github.com/supabase/cli/tree/3cb948c5a70d31fbcb0fd1dcc616ee196a125cd0):
apps/cli/src/command-internal/migration-history.ts, sql-split.ts e o handler de
migration repair. O CLI 2.119.0 gerou os dois nomes de migration; zip Windows
verificado contra checksums.txt oficial:
db4a6ec26d182408ca605efc0d0d938720bd2d8d39541e79c7d69043897affb9.
Ferramentas temporarias ficaram em test-results/, ignorado pelo Git, sem
instalacao global nem novas dependencias do app. O CLI gera supabase/.temp;
esse cache, assim como .branches, agora e ignorado.

list_migrations e comparacao SQL de version/name/statements confirmaram as
12 migrations, com source_matches=true para todas. Aplicacoes futuras devem
verificar historico antes de db push; nao alterar migrations ja aplicadas.

## Validacao real

Auditoria remota confirmou:

- RLS nas 18 tabelas; zero grants TRUNCATE/TRIGGER/REFERENCES aos dois roles cliente.
- Funcoes privilegiadas pertencem a postgres, com paths fixos. Reserva, claim e
  gravacao de eventos Stripe: sem EXECUTE de anon/authenticated, permitido a service_role.
- URL privada do Checkout e campos role/email/id nao podem ser lidos/alterados
  pelo cliente fora dos grants previstos; perfis nao sao diretorio publico.
- unaccent em extensions e slugify funcional. Snapshot sem SELECT de clientes.
- Script scripts/payments/supabase-permissions-probe.sql executado neste projeto:
  dono ve seu perfil/reserva; segundo dono nao ve nem altera o primeiro;
  anon ve catalogo ativo, nao perfis/pedidos; role em user_metadata nao promove
  usuario; alterar role, reservar vendedor, ler URL privada e TRUNCATE sao negados.
- Probe usa duas identidades sinteticas, claims SQL e ROLLBACK. Nao comprova
  validacao de JWT pelo Auth ou login por browser. Uma primeira fixture de preco
  tinha identificador invalido; foi rejeitada e revertida, corrigida e reexecutada.
- Depois do probe: auth.users, public.users, products, prices, reservas de
  Checkout e vendedores continuam com zero registros. Nenhum pagamento processado.

SQL local: 40 casos; 34 aprovados no PGlite, seis de concorrencia exclusivos
do PostgreSQL nativo marcados SKIP. Evidencia CI sera registrada no handoff.
O harness SQL descartavel nao foi apontado para o banco remoto.

## Advisors e limites restantes

Nao ha aviso de RLS ausente, search_path mutavel, unaccent em public ou snapshot
publico apos os ajustes. O advisor nao esta totalmente verde:

- [PostgreSQL 17.4.1.075 com patches pendentes](https://supabase.com/docs/guides/platform/upgrading):
  gate antes de abrir pagamentos ao publico. Atualizacao/reinicio exige plano
  de recuperacao e autorizacao separada; nao foi executada nesta etapa.
- Tres tabelas server-only com RLS sem policies: password_reset_tokens,
  stripe_checkout_events e stripe_connect_events. Deny-by-default para clientes
  e intencional; nao criar policies permissivas para ocultar o aviso.
- GraphQL descobre oito objetos anon e 18 authenticated; isso e visibilidade
  de schema, nao prova de acesso a todas as linhas. Catalogo/conteudo publicos
  e dados privados owner-scoped foram mantidos e testados por SQL.
- is_admin anon e seis helpers SECURITY DEFINER authenticated permanecem
  intencionais para policies/entitlements. Consultam identidade auth.uid(),
  nao metadata editavel; donos/paths/grants auditados. Revisar antes de ampliar API.
- Performance: cinco FKs sem indice, nove initplans de Auth, cinco conjuntos
  de policies permissivas e 18 indices ainda sem uso. Registrar backlog; nao
  executar refatoracoes amplas nem remover indices de uma base nova por esse sinal.

Faltam Auth real (emails, CAPTCHA, callbacks), runtime HTTPS/host com limite
financeiro aprovado, WAF/quotas/alertas e fluxo Stripe de teste com webhook.
Banco preparado nao equivale a aplicativo conectado nem a gateway pronto.
RLS nao impede trafego abusivo ou garante disponibilidade/custo total.
Main/preview nao foram promovidas. Proximo passo operacional:
[STRIPE_CHECKOUT_SETUP.md](STRIPE_CHECKOUT_SETUP.md).
