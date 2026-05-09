const { once } = require("node:events");
const LoggedEntity = require("../lib/LoggedEntity");

class RequestParser extends LoggedEntity {
    constructor() {
        // Making this a LoggedEntity provides access to logging methods.
        super("req-parser");
    }

    async parse_request(req) {
        const [path, raw_params] = req.url.split('?');

        let params = {};
        if (raw_params) {
            params = Object.fromEntries(
                raw_params.split('&').map((e) => e.split('='))
            );
        }

        const method = req.method;
        const headers = req.headers;

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });

        // Wait for all data to be received
        await once(req, 'end');

        return { 
            path,
            params,
            method,
            headers,
            body
        };
    }
}

module.exports = RequestParser;
