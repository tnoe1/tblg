const EventEmitter = require("node:events");

class LoggedEntity extends EventEmitter {
    constructor(tag) {
        super();
        // Note: there is no guarantee that these will be unique.
        this.tag = tag;
        this.logger = {
            info: (s) => {
                console.log(
                    `\x1b[38;5;46m[${this.tag}] \x1b[0m\x1b[38;5;51m%s\x1b[0m`,
                    s
                );
            },
            warn: (s) => {
                console.log(
                    `\x1b[38;5;46m[${this.tag}] \x1b[0m\x1b[0;49;93m%s\x1b[0m`,
                    s
                );
            },
            error: (s) => {
                console.log(
                    `\x1b[38;5;46m[${this.tag}] \x1b[0m\x1b[0;49;91m%s\x1b[0m`,
                    s
                );
            }
        };
    }
}

module.exports = LoggedEntity;
