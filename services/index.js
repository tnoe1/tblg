const db = require("../db");
const ServiceInterface = require("./ServiceInterface");

module.exports = {
    service_interface: new ServiceInterface(db)
}
