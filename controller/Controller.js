const http = require('http');
const LoggedEntity = require("../lib/LoggedEntity");

const RequestParser = require("./RequestParser");
const RequestRouter = require("./RequestRouter");

class Controller extends LoggedEntity {
    #services;
    #server;

    constructor(services) {
        super("controller");
        this.#services = services;
        this.parser = new RequestParser();
        this.router = new RequestRouter();

        this.config = null;
        this.#server = http.createServer(this.handle_request.bind(this));
    }

    configure(config) {
        this.config = config;
    }

    start() {
        if (!this.config) {
            this.logger.error(
                'Need to run configure() before starting controller'
            );
            return;
        }

        const port = this.config.app.port;
        this.#server.listen(port, () => {
            this.logger.info(`tblg server listening on port ${port}`);
        });
    }

    /**
     * This will get called every time a request comes in.
     */
    handle_request(req, res) {
        const req_obj = this.parser.parse_request(req);
        this.logger.info(JSON.stringify(req_obj));
        
        // TODO: Need to put body stream consolidation into parse_request.
        // This will likely involve Promises and async shenanigans.

        // chunk is a Buffer
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            this.logger.info(`body: ${body}`);
        });

        // req is an IncomingMessage
        // res is a ServerResponse

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello from tblg\n');
    }
}

module.exports = Controller;
