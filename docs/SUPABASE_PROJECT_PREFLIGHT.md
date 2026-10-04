# Supabase do Millennium: verificacao antes de migrar

Snapshot em 2026-10-03, 22:27 America/Sao_Paulo (2026-10-04, 01:27 UTC).
Somente leitura pela conexao Supabase autorizada. Revalidar antes de alterar
o banco; este registro nao equivale a autorizacao de deploy ou pagamentos.

## Projeto indicado por Gabriel

- URL publica: https://pywotovmlxzwwpawpaew.supabase.co
- Ref: pywotovmlxzwwpawpaew; nome: gabbswq's Project.
- Organizacao gabbswq, plano Free, regiao sa-east-1 (Sao Paulo).
- Estado confirmado pela API: ACTIVE_HEALTHY.
- PostgreSQL confirmado por SQL: 17.4; versao da plataforma: 17.4.1.075.

A URL identifica o backend Supabase, nao uma interface web do Millennium.
O rotulo producao/principal no dashboard identifica a instancia primaria do
Supabase, nao a branch Git main. Nao assumir que ele autoriza escrita no banco.

## Inventario observado

Consultas executadas em transacao READ ONLY, com statement_timeout de 5s.
Nenhuma senha, chave, email ou registro pessoal foi consultado.

| Item | Resultado |
| --- | --- |
| Tabelas/views/materialized views em public e millennium_payments | Nenhuma |
| Funcoes nos dois schemas | Nenhuma |
| Usuarios em auth.users | 0 |
| Buckets de Storage | 0 |
| Historico retornado por list_migrations | Vazio |
| supabase_migrations.schema_migrations | Nao existe |
| Triggers nao internos de auth.users | Nenhum |
| Extensao unaccent | Disponivel, ainda nao instalada |
| Dono do schema public | pg_database_owner |
| CREATE em public: postgres | Permitido |
| CREATE em public: anon/authenticated/service_role | Negado |
| BYPASSRLS: postgres/service_role | Sim |
| BYPASSRLS: anon/authenticated | Nao |

Extensoes instaladas: pg_graphql 1.5.11, pg_stat_statements 1.11,
pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1 e uuid-ossp 1.1.
O inventario nao afirma ausencia de qualquer recurso em outros schemas,
configuracoes de Auth, Edge Functions, endpoints ou integracoes externas.

## Alerta real de seguranca

O advisor retornou vulnerable_postgres_version (WARN), com patches pendentes
para supabase-postgres-17.4.1.075. Nao classificar o projeto como seguro apenas
porque o schema de aplicacao esta vazio.

[Guia de atualizacao indicado pelo advisor](https://supabase.com/docs/guides/platform/upgrading).
[Changelog PostgreSQL 15.19 / 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
Confirmar versao disponivel, backup/restauracao e permissao humana antes da
atualizacao; esta verificacao nao atualizou nem reiniciou a instancia.
Repetir version() e o advisor depois. Correcao do alerta e um gate antes de
abrir pagamentos ao publico, nao uma garantia de ausencia de vulnerabilidades.

## Custos e limites

O plano observado e Free. Segundo a
[documentacao de custos](https://supabase.com/docs/guides/platform/cost-control),
nao ha cobranca enquanto a organizacao permanece no Free. Excesso ou abuso
pode restringir/pausar o servico, conforme a
[politica de uso](https://supabase.com/docs/guides/platform/billing-faq).
Isso nao protege a disponibilidade nem cobre gastos de Stripe ou hospedagem.

Spend Cap e um recurso Pro, nao um teto total: compute e outros adicionais
opt-in ficam fora dele. Nao mudar plano, habilitar adicionais, criar branch
paga ou prometer protecao absoluta de custo. RLS protege dados; nao impede
sozinho o consumo de trafego/requisicoes. WAF/limites antes da invocacao,
quotas e resposta a abuso continuam sendo gates da hospedagem.

## Proxima aplicacao, ainda nao executada

Gabriel recebeu uma pergunta explicita sobre aplicar as migrations neste
projeto primario. A URL confirma a escolha do projeto, nao uma resposta a
essa pergunta. Nenhuma DDL, DML, migration, chave, webhook ou plano foi alterado.

1. Obter autorizacao para modificar esta instancia, mantendo homologacao e
   Stripe test-only. Revalidar inventario; se surgirem dados, parar e revisar
   backup/restauracao e conflitos antes de continuar.
2. Aplicar a cadeia completa de dez migrations de supabase/migrations, na
   ordem dos arquivos. As tres migrations Stripe/hardening nao substituem as
   sete anteriores de auth/catalogo. Nao modificar as migrations existentes.
3. Garantir que o historico remoto corresponde aos arquivos/versionamentos
   locais. A assinatura MCP apply_migration recebe nome/query, sem parametro
   de versao; nao presumir equivalencia dos timestamps nem improvisar INSERTs
   no historico. Verificar o mecanismo antes de publicar ou usar db push.
4. Auditar donos de funcoes SECURITY DEFINER, grants e RLS efetivos, isolamento
   entre dois usuarios e acesso anonimo. Repetir advisor e confrontar schema
   com os tipos usados pelo app. Nao chamar a suite SQL descartavel neste banco:
   ela aceita apenas localhost vazio com nome millennium_test_*.
5. Configurar runtime e callbacks por canal seguro, sem colar credenciais no
   chat ou editar .env. Homologar login real antes de ativar Checkout de teste;
   Vendedores/Connect continua um menu separado, sem repasses/comissoes.

Roteiro completo: [STRIPE_CHECKOUT_SETUP.md](STRIPE_CHECKOUT_SETUP.md).
Nao implantar as Edge Functions legadas para o Checkout novo. Main e preview
continuam fora deste incremento; o fluxo Git e feature -> develop.
