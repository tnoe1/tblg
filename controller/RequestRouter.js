const fs = require("node:fs");
const path = require("node:path");
const LoggedEntity = require("../lib/LoggedEntity");

const PUBLIC_PATH = path.resolve(__dirname, "../views/public");

class RequestRouter extends LoggedEntity {
    #services;

    constructor(services) {
        super("req-router");
        this.route_map = {
            "/": this.serve_home.bind(this),
            "/test": this.test_route.bind(this)
        };
        this.#services = services;

        // Add items in public folder to route_map
        let items;
        try {
            items = fs.readdirSync(PUBLIC_PATH, { withFileTypes: true });
        } catch (err) {
            this.logger.error(
                `Encountered a problem while trying to ` + 
                `read ${PUBLIC_PATH}: ${err}`
            );
            // Will induce a graceful server cleanup
            process.kill(process.pid, 'SIGTERM');
        }

        const files = items.filter((i) => i.isFile()).map((i) => i.name);
        files.forEach((f) => {
            this.route_map[`/${f}`] = this.serve_asset.bind(this); 
        });
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
                status_message: 'Bad Request',
                headers: {
                    'Content-Type': 'text/html; charset=UTF-8'
                },
                content: '404: Bad Request'
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
                content: '500: Internal server error'
            };
        }

        return {
            status: 200,
            status_message: 'OK',
            headers: {
                'Content-Type': 'text/html; charset=UTF-8'
            },
            content: home_html 
        };
    }

    _get_asset_content_type(path) {
        const extension = path.split(".").pop().toLowerCase();

        let ext_map = {
            'jpg': "image/jpeg",
            'jpeg': "image/jpeg",
            'png': "image/png",
            'webp': "image/webp",
            'gif': "image/gif",
            'html': "text/html; charset=UTF-8",
            'css': "text/css",
            'svg': "image/svg+xml",
            'xml': "application/xml",
            'txt': "text/plain"
        };

        return ext_map[extension] ?? null;
    }

    _is_safe(asset_path) {
        const resolved_path = path.resolve(
            PUBLIC_PATH,
            asset_path.split("/").pop()
        );
        return resolved_path.startsWith(PUBLIC_PATH + path.sep);
    }

    async serve_asset(req_obj) {
        this.logger.info(
            `Received ${req_obj.method} request at ${req_obj.path}`
        );

        // Check for request issues
        const asset_content_type = this._get_asset_content_type(req_obj.path);
        if (asset_content_type === null || !this._is_safe(req_obj.path)) {
            this.logger.error(`Request attempted to escape from public ` +
                `directory. Possible directory traversal attack.`);
            return {
                status: 404,
                status_message: 'Bad Request',
                headers: {
                    'Content-Type': 'text/html; charset=UTF-8'
                },
                content: '404: Bad Request'
            };
        }

        const asset = await this.#services.load_asset(
            path.join(PUBLIC_PATH, req_obj.path)
        );

        // If something went wrong while trying to load the asset, server error.
        if (asset === null) {
            return {
                status: 500,
                status_message: 'Internal Server Error',
                headers: {
                    'Content-Type': 'text/html; charset=UTF-8'
                },
                content: '500: Internal Server Error'
            };
        }

        return {
            status: 200,
            status_message: 'OK',
            headers: {
                'Content-Type': asset_content_type
            },
            content: asset
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

