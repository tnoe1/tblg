/*
 * At a high level, I need a few things:
 *     i) A database
 *     ii) The application server
 */

const env = require('./env.js');
const app = require('./controller')

const http = require('http');

const run = async () => {
    // Pass the environment to the controller
    app.controller.configure(env);
    app.controller.start();
};

const shutdown = (signal) => {
    // Log that graceful shutdown is happening
    //
    // Shutdown DB
    //
    // Clean up

    // Log complete
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

(async () => run())();
