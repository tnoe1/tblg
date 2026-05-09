const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");
const LoggedEntity = require("../lib/LoggedEntity");

class ServiceInterface extends LoggedEntity {
    #db_interface;

    constructor(db_interface) {
        super("service-interface");
        this.#db_interface = db_interface;
    }

    async _file_exists(path) {
        let file_exists;
        try {
            await fs.access(path, constants.F_OK);
            file_exists = true;
        } catch (err) {
            file_exists = false;
        }

        return file_exists;
    }

    async load_home() {
        const home_path = path.join(__dirname, "../views/index.html");

        let home_page = null;
        try {
            home_page = await fs.readFile(home_path, { encoding: 'utf8' });
        } catch (err) {
            this.logger.error(`Failed to load home page: ${err}`);
        }

        return home_page;
    }
}

module.exports = ServiceInterface;
