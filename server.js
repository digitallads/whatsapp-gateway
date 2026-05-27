require('dotenv').config();
const axios = require('axios');
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
  try {
    const { instanceId, number, message } = job.data;

    console.log('Iniciando warmup da sessão...');

    // 1. PRESENCE COMPOSING
    await axios.post(
      'https://crmx1.uazapi.com/message/presence',
      {
        number,
        presence: 'composing',
        delay: 5000
      },
      {
        headers: {
          token: process.env.UAZAPI_TOKEN
        }
      }
    );

    console.log('Presence enviada');

    // Delay humano
    await new Promise(resolve => setTimeout(resolve, 4000));

    console.log('Enviando mensagem...');

    // 2. ENVIO REAL
    const sendResponse = await axios.post(
      'https://crmx1.uazapi.com/send/text',
      {
        number,
        text: message
      },
      {
        headers: {
          token: process.env.UAZAPI_TOKEN
        }
      }
    );

    console.log('Mensagem enviada:', sendResponse.data);

    // 3. PAUSED
    await axios.post(
      'https://crmx1.uazapi.com/message/presence',
      {
        number,
        presence: 'paused'
      },
      {
        headers: {
          token: process.env.UAZAPI_TOKEN
        }
      }
    );

    console.log('Pipeline concluído');

  } catch (err) {
    console.error('Erro pipeline:', err.response?.data || err.message);

    throw err;
  }
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
const PORT = process.env.PORT || 3001;

await app.listen({
  port: PORT,
  host: '0.0.0.0'
});

   console.log(`Gateway rodando na porta ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
