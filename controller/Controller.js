const http = require('http');
const LoggedEntity = require("../lib/LoggedEntity");

const RequestParser = require("./RequestParser");
const RequestRouter = require("./RequestRouter");

class Controller extends LoggedEntity {
    #server;

    constructor(services) {
        super("controller");
        this.parser = new RequestParser();
        this.router = new RequestRouter(services);

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

            // Has a status, has headers, has message
            const info = await this.router.route(req_obj)

            res.writeHead(info.status, info.headers);
            res.end(info.content);
        } catch (err) {
            this.logger.error(err);
            res.writeHead(500);
            res.end('Internal server error\n');
        }
    }
}

module.exports = Controller;
