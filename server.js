require('dotenv').config();

const Fastify = require('fastify');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const app = Fastify({
  logger: true
});

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

const messageQueue = new Queue('messages', {
  connection
});

const worker = new Worker(
  'messages',
  async job => {
    console.log('Processando mensagem:', job.data);

    // Aqui depois entra UazAPI
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Mensagem processada');
  },
  {
    connection
  }
);

worker.on('completed', job => {
  console.log(`Job ${job.id} concluído`);
});

worker.on('failed', (job, err) => {
  console.error(`Job falhou: ${err.message}`);
});

app.get('/', async () => {
  return {
    status: 'ok',
    service: 'whatsapp-gateway',
    queue: 'online'
  };
});

app.post('/send-message', async (request, reply) => {
  try {
    const { instanceId, number, message } = request.body;

    const job = await messageQueue.add('send', {
      instanceId,
      number,
      message
    });

    return {
      success: true,
      queued: true,
      jobId: job.id
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
