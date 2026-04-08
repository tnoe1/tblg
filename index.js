/*
 * At a high level, I need a few things:
 *     i) A database
 *     ii) The application server
 */

const env = require('./env.js');
const db = require('./db');

const run = async () => {
    // const init_post_data = db.posts.create_post({
    //     author: "Thomas Noel",
    //     content: "I love Susannah!!!",
    //     categories: ["Love", "Family"]
    // });

    // const next_post_data = db.posts.create_post({
    //     author: "Thomas Noel",
    //     content: "I love Ivan too!!!",
    //     parent_id: init_post_data.data.id,
    //     categories: ["Love", "Family"]
    // });

    const next_post_data = db.posts.create_post({
        author: "Thomas Noel",
        content: "<p>Lance the Turtle, Aloha Lance!</p>",
        categories: ["VeggieTales", "Funny", "IvanFav"]
    });
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
