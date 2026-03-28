require('dotenv').config()

module.exports = {
    db: {
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,

    }
};
