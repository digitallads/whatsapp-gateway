require('dotenv').config();

const Fastify = require('fastify');

const app = Fastify({
  logger: true
});

app.get('/', async () => {
  return {
    status: 'ok',
    service: 'whatsapp-gateway'
  };
});

app.post('/send-message', async (request, reply) => {
  try {
    const { instanceId, number, message } = request.body;

    console.log('Mensagem recebida:', {
      instanceId,
      number,
      message
    });

    return {
      success: true,
      status: 'queued'
    };
  } catch (err) {
    console.error(err);

    return reply.status(500).send({
      success: false,
      error: err.message
    });
  }
});

const start = async () => {
  try {
    await app.listen({
      port: 3001,
      host: '0.0.0.0'
    });

    console.log('Gateway rodando na porta 3001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
