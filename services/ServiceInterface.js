
class ServiceInterface {
    #db_interface;

    constructor(db_interface) {
        this.#db_interface = db_interface;
    }

    load_home() {
        // TODO
    }
}

module.exports = ServiceInterface;
