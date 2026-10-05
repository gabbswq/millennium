import rateLimit from '@fastify/rate-limit';
import { LabError } from './domain.mjs';
import { SnapshotStore } from './rate-limit-store.mjs';

export function configureHttp(app) {
  app.register(rateLimit, {
    global: false, max: 120, timeWindow: 60000, cache: 1,
    keyGenerator: () => 'listener', store: SnapshotStore, skipOnError: false, continueExceeding: false,
    errorResponseBuilder: () => new LabError(429, 'Muitas requisicoes. Aguarde antes de tentar novamente.'),
  });
  let ingress, mutations;
  app.after((error, done) => {
    if (error) return done(error);
    ingress = app.rateLimit();
    mutations = app.createRateLimit({ max: 20 });
    done();
  });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    // Shared listener budgets also cover invalid origins and unmatched URLs.
    await ingress(request, reply);
    if (!['GET', 'HEAD'].includes(request.method) && request.routeOptions.url !== '/webhooks/asaas') {
      const budget = await mutations(request);
      if (budget.isExceeded) {
        reply.header('Retry-After', budget.ttlInSeconds);
        throw new LabError(429, 'Muitas requisicoes. Aguarde antes de tentar novamente.');
      }
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const status = error instanceof LabError ? error.status : error.validation || error.statusCode === 400 ? 400 : error.statusCode === 413 ? 413 : error.statusCode === 415 ? 415 : 500;
    reply.code(status).send({ error: error instanceof LabError ? error.message : status === 400 ? 'Campos invalidos na requisicao.' : status === 413 ? 'Requisicao acima do limite local.' : status === 415 ? 'Use application/json.' : 'Falha interna. Os registros de teste foram preservados.' });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'Recurso nao encontrado.' }));
}

export function registerWebhook(app, payments) {
  app.post('/webhooks/asaas', {
    onRequest: async request => payments.authorizeWebhook(request.headers['asaas-access-token']),
    schema: { body: { type: 'object', required: ['id', 'event'], properties: {
      id: { type: 'string', minLength: 1, maxLength: 150 },
      event: { type: 'string', minLength: 1, maxLength: 100 }, payment: { type: 'object' },
    } } },
  }, async request => payments.webhook(request.body, request.headers['asaas-access-token']));
}
