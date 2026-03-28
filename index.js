/*
 * At a high level, I need a few things:
 *     i) A database
 *     ii) The application server
 */

const { Pool } = require('pg');
const env = require('./env.js');

const run = async () => {
    const pool = await new Pool({
    });
    const query = (text, params) => pool.query(text, params);


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
