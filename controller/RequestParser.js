
class RequestParser {
    parse_request(req) {
        console.log(req.url);
        const [path, raw_params] = req.url.split('?');
        console.log(raw_params);
        const params = Object.fromEntries(
            raw_params.split('&').map((e) => e.split('='))
        );

        const method = req.method;
        const headers = req.headers;
        const body = null; // TODO

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
