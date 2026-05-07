const Controller = require("./Controller");
const { service_interface } = require("../services");

module.exports = {
    controller: new Controller(service_interface)
};
