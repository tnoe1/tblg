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
        this.#server = null; 
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
        this.#server = http.createServer(this.handle_request.bind(this));
        this.#server.listen(port, () => {
            this.logger.info(`tblg server listening on port ${port}`);
        });
    }

    /**
     * This will get called every time a request comes in.
     *    req is an IncomingMessage
     *    res is a ServerResponse
     */
    async handle_request(req, res) {
        try {
            const req_obj = await this.parser.parse_request(req);
            this.logger.info(JSON.stringify(req_obj));

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ACK from tblg\n');
        } catch (err) {
            this.logger.error(err);
            res.writeHead(500);
            res.end('Internal server error\n');
        }
    }
}

module.exports = Controller;
