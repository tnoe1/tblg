const Controller = require("./Controller");
const services = require("../services");

module.exports = {
    controller: new Controller(services)
};
