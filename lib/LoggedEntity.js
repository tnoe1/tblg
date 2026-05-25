const EventEmitter = require("node:events");

class LoggedEntity extends EventEmitter {
    static max_length = 0;

    constructor(tag) {
        super();

        // Note: there is no guarantee that these will be unique.
        this.tag = tag;

        // TODO: FIGURE OUT WHETHER OR NOT PADDING IS "GOOD"
        let tag_is_new_longest = LoggedEntity.max_length - this.tag.length < 0;
        if (tag_is_new_longest) LoggedEntity.max_length = this.tag.length;

        this.logger = {
            info: (s) => {
                const rtag = `[${this.tag}]`.padEnd(LoggedEntity.max_length);
                console.log(
                    `\x1b[38;5;46m` + 
                        `${rtag} ` +
                        `\x1b[0m\x1b[38;5;51m%s\x1b[0m`,
                    s
                );
            },
            warn: (s) => {
                const rtag = `[${this.tag}]`.padEnd(LoggedEntity.max_length);
                console.log(
                    `\x1b[38;5;46m` + 
                        `${rtag} ` +
                        `\x1b[0m\x1b[0;49;93m%s\x1b[0m`,
                    s
                );
            },
            error: (s) => {
                const rtag = `[${this.tag}]`.padEnd(LoggedEntity.max_length);
                console.log(
                    `\x1b[38;5;46m` + 
                        `${rtag} ` +
                        `\x1b[0m\x1b[0;49;91m%s\x1b[0m`,
                    s
                );
            }
        };
    }
}

module.exports = LoggedEntity;
