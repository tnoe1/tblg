const RequestHandler = require("./request_handler");

module.exports = {
    request_handler: new RequestHandler(db) // TODO: logging?
};
