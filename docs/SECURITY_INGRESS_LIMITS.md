# Limites de ingresso do laboratorio

Data: 2026-10-05. Base develop 4ad7f655; feature/security-ingress-limit.
Escopo: Fastify do laboratorio Pix e receptor opcional. Stripe/Next.js,
Supabase remoto, credenciais, UI, main e planos nao alterados.

## Controle

Plugin oficial @fastify/rate-limit 11.2.0, compativel com Fastify 5. Lockfile
preserva versoes existentes; instalacao com ignore-scripts. Sem Redis/servico.
ConfigureHttp instala hook onRequest antes de origem/CSRF, autorizacao,
parsing/schema e handlers. Aplica-se tambem a 404 e HEAD.

- 120 requisicoes por listener por janela fixa de 60 segundos.
- 20 mutacoes no painel por janela, salvo a rota autenticada de webhook.
- Chave constante do listener, nao URL, IP, query, token ou identidade do browser.
- Uma entrada em memoria por store; limite geral e mutacoes sao separados.
- 429 com prazo restante inteiro real; tentativas recusadas nao renovam janela.
- Limites independentes entre painel e receptor; nunca dispensar autenticacao.

O store local da versao fixada retorna o mesmo objeto mutavel a callbacks
concorrentes. Rajada de 125 GET reproduziu zero admitidos, embora a quota
permita 120. SnapshotStore herda o store oficial e copia o resultado antes
do callback; nao reimplementa contador/expiracao/cache. Child preserva esse
comportamento para o limite de mutacoes. O import do store e um caminho interno
da dependencia fixada: qualquer upgrade exige rever esse contrato e as regressoes.

## Evidencia local

Nove testes iniciais falharam sem o controle; um contador de preParsing foi
corrigido para excluir o GET de sessao e sua falha foi reproduzida novamente
antes da implementacao. Tres testes adicionais cobrem rajada concorrente,
HTTP real com corpo declarado mas nao enviado e recuperacao de mutacoes.

- [x] 12 regressoes no Windows; zero SKIP.
- [x] 51 testes API/provedor/receptor no Ubuntu; zero SKIP.
- [x] Build local aprovado; JavaScript da tela 12111 bytes, sem alteracao da UI.
- [x] npm audit --omit=dev no laboratorio: zero alertas conhecidos.
- [ ] CI do codigo final, SQL nativo, navegador e CodeQL na ref da feature.
- [ ] Integracao develop e verificacao dos checks/alertas da mesma ref.

Requests recusados nao chamam provedor, nao criam registros, nao leem assets
nem chegam ao preParsing. Headers inventados e troca de endereco/URL nao
renovam a quota. Janela expira mesmo sob novas recusas. Uma conexao HTTP real
recebeu 429 sem precisar enviar o corpo declarado, em listener loopback efemero.
Fixtures sinteticas; nenhuma carga contra terceiros ou dado financeiro real.

Navegador Windows nao estava instalado; tentativa oficial de download no cache
privado do workspace falhou por timeout de rede. Os 12 testes visuais locais
nao executaram seus fluxos por esse motivo. Build inicialmente negado pelo
sandbox foi aprovado com acesso revisado; nenhuma restricao foi contornada.
Instalacao npm teve warnings de limpeza de bins antigos Windows/WSL, sem
falha; o diff do lockfile acrescenta apenas plugin/dependencias necessarias.

## Limites e continuidade

Orcamento e de processo, compartilhado por todos os clientes do listener;
um atacante ainda pode prejudicar disponibilidade legitima nessa janela.
Reinicio zera memoria. O controle nao limita bytes recebidos antes do Node,
conexoes no host, replicas, chamadas diretas ao Supabase nem fatura de terceiros.
Painel continua privado/loopback; receptor nao foi exposto e tunnel nao autorizado.

WAF, limites financeiros e Auth/Stripe TEST externos exigem hospedagem e
homologacao. Login Vercel ainda depende de Gabriel. Nao certificar seguranca
ou encerrar a meta por testes verdes; alertas CodeQL aguardam analise atual.

## Fontes primarias

- [Plugin oficial](https://github.com/fastify/fastify-rate-limit): hooks, store customizado, headers e limites por processo.
- [Store fixado 11.2.0](https://github.com/fastify/fastify-rate-limit/blob/v11.2.0/store/LocalStore.js): contador, objeto retornado e expiracao.
- [Hooks Fastify](https://fastify.dev/docs/latest/Reference/Hooks/): onRequest precede leitura de payload.
- [OWASP DoS](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html): controle em camadas, nao apenas dentro da aplicacao.
