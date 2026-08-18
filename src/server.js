require('dotenv').config();
const app = require('./app');
const config = require('./core/config');

const server = app.listen(config.port, () => {
  console.log(`Auto Edit Video is ready at http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Closing HTTP server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
