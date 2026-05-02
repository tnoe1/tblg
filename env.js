require('dotenv').config()
const env = process.env;

module.exports = {
    app: {
        port: env.TBLG_PORT
    }
};
