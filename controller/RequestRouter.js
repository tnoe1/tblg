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
    async route(req_obj) {
        if (!(req_obj.path in this.route_map)) {
            return {
                status: 404,
                body: { message: "Resource not found\n" }
            };
        }

        return await this.route_map[req_obj.path](req_obj);
    }

    async serve_home(req_obj) {
        this.logger.info(
            `Received ${req_obj.method} request at ${req_obj.path}`
        );
        const home_html = await this.#services.load_home()

        if (home_html === null) {
            return {
                status: 500,
                status_message: 'Internal server error',
                headers: {
                    'Content-Type': 'text/html; charset=UTF-8'
                },
                content: '<p>500: Internal server error</p>'
            };
        }

        // TODO: Serve it!
        return {
            status: 200,
            status_message: 'OK',
            headers: {
                'Content-Type': 'text/html; charset=UTF-8'
            },
            content: home_html 
        };
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
            status_message: 'OK',
            headers: {
                'Content-Type': 'text/plain'
            },
            content: 'ACK from tblg\n'
        };
    }
}

module.exports = RequestRouter;

