const fastify = require('fastify')({ logger: true });
const bcrypt = require('bcrypt');
require('dotenv').config();
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    port: 5432,
    user: 'Sonny',
    password: '',
    database: 'daily-snail',
  },
});

const SALT = process.env.SALT;

const PORT = process.env.PORT;

fastify.get('/', async (req, reply) => {
  reply.send({ hi: 'world' });
});

fastify.post('/signup', async (req, reply) => {
  const { email, name, password } = req.body;
  const joined = new Date();
  const hash = await bcrypt.hash(password, SALT);

  // console.log('RETURNED HASH', hash);
  // transaction aborts the table insertions if one of the tables fails so that we don't have orphan data
  knex
    .transaction((trx) => {
      trx
        .insert({ email, hash })
        // .then((user) => reply.status(200).send(user))
        .into('login')
        .returning('email')
        .then((loginEmail) => {
          console.log('LOGINEMAIL: ', loginEmail[0].email);
          return trx('users')
            .returning('*')
            .insert({
              email: loginEmail[0].email,
              name,
              joined,
            })
            .then((user) => reply.code(200).send(user[0]));
        })
        .then(trx.commit)
        .catch(trx.rollback);
    })
    .catch((err) => reply.status(400).send('Unable to sign up'));
});

fastify.post('/signin', async (req, reply) => {
  const { email, password } = req.body;
  console.log('EMAIL AND PW: ', email, password);
  knex
    .select('hash')
    .from('login')
    .where('email', email)
    .then((hashedpw) => {
      console.log('HASHEDPW: ', hashedpw[0].hash);
      bcrypt
        .compare(password, hashedpw[0].hash)
        .then((response) => {
          console.log('hashed pw is: ', response);
          reply.send('good pw', response);
        })
        .catch((err) => reply.send(new Error('wrong password')));
    })
    .catch((err) => reply.send(new Error('error logging in')));
});

fastify.get('/profile/:id', (req, reply) => {
  const { id } = req.params;
  knex
    .select('*')
    .from('users')
    .where('id', id)
    .then((user) => {
      console.log('user id search: ', user);

      if (user.length === 0) {
        reply.status(400).send('no user found');
      } else {
        reply.status(200).send(user[0]);
      }
    })
    .catch((err) => {
      reply.status(404).send(new Error('error finding user'));
    });
});

const start = async () => {
  try {
    await fastify.listen({ port: `${PORT}`, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
