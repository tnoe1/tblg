const LoggedEntity = require("../lib/LoggedEntity");

class RequestRouter extends LoggedEntity {
    #services;

    constructor(services) {
        super("req-router");
        this.route_map = {
            "/": this.serve_home.bind(this),
            "/test": this.test_route.bind(this)
        };
        this.#services = services;
    }

    /**
     * Routes request to appropriate service.
     *
     * req_obj contains:
     *     - path
     *     - params (query parameters)
     *     - method
     *     - headers
     *     - body
     */
    route(req_obj) {
        if (!(req_obj.path in this.route_map)) {
            return {
                status: 404,
                body: { message: "Resource not found\n" }
            };
        }

        return this.route_map[req_obj.path](req_obj);
    }

    serve_home(req_obj) {
        const home_html = this.#services.load_home()

        // TODO: Serve it!
    }

    test_route(req_obj) {
        this.logger.info(`Received a test ${req_obj.method} request:`);
        this.logger.info(`    with headers: ${
            Object.entries(req_obj.headers).map((p) => `[${p[0]},${p[1]}]`)
        }`);
        if (req_obj.body) {
            this.logger.info(`    with body: ${req_obj.body}`);
        }
        if (Object.keys(req_obj.params).length > 0) {
            this.logger.info(`    with query parameters: ${
                Object.entries(req_obj.params).map((p) => `[${p[0]},${p[1]}]`)
            }`);
        }

        return {
            status: 200,
            body: { message: 'ACK from tblg\n' }
        };
    }
}

module.exports = RequestRouter;

