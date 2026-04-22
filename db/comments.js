
/**
 * Comments are at least names and a text string, but can also include
 * an email address and a url. All comments are associated with a post.
 *
 */
class CommentInterface {
    #db;

    constructor(db, logger) {
        this.#db = db;
        this.logger = logger;
    }

    get_user_by_id(id) {
        const stmt = this.#db.prepare(`SELECT * FROM users WHERE id = ?`);
        let data = stmt.get(id);

        let message = `Successfully retrieved user with id ${id}`;
        let success = true;
        if (data === undefined) {
            success = false;
            message = `Couldn't find a user with id ${id}`;
            data = {};
        }

        return { success, data, message };
    }

    /**
     * Gets any user rows matching the specified criteria. A name
     * MUST be specified.
     */
    get_user({ name, email, url } = {}) {
        let message;
        if (!name) {
            message = `Failed to query user: must specify a name`;
            return {
                success: false,
                data: {},
                message: message
            };
        }

        let conditions = ` name = ?`;
        let args = [name];
        if (email) {
            conditions += ` AND email = ?`;
            args.push(email);
        }

        if (url) {
            conditions += ` AND url = ?`;
            args.push(url);
        }

        const stmt = this.#db.prepare(`SELECT * FROM users WHERE` + conditions);
        let data = stmt.get(...args);

        let success = true;
        message = `Successfully retrieved ${data.length} entries for user` +
            ` with name ${name}, email ${email ?? "?"}, and url ${url ?? "?"}`;
        if (data.length === 0) {
            success = false;
            message = `Couldn't find any users with name ${name}, ` +
                `email ${email ?? "?"}, and url ${url ?? "?"}`;
        }

        return { success, data, message };
    }

    create_user({ name, email, url } = {}) {
        let fields = "name";
        let args = [name];
        if (email) {
            fields += ", email";
            args.push(email);
        }

        if (url) {
            fields += ", url";
            args.push(url);
        } 

        const stmt = this.#db.prepare(`
            INSERT INTO users (${fields}) 
                VALUES (${('?, '.repeat(args.length)).slice(0, -2)})
        `);
        const info = stmt.run(...args);

        let success = true;
        let message = "Successfully created new user";
        let data = {};
        if (info.changes < 1) {
            message = "Failed to create new user";
            this.logger.error(message);
            success = false;

            return { success, data, message };
        }

        const user_id = info.lastInsertRowid;
        data = this.get_user_by_id(user_id).data;

        if (Object.keys(data).length > 0) {
            this.logger.info(
                `New user with id ${user_id} added to database`
            );
        } else {
            this.logger.error(`Couldn't find new user in database`);
        }

        return {
            success: success,
            data: data ?? {},
            message: message
        };
    }

    // TODO
    update_user() {}

    // TODO
    delete_user() {}

    get_comment_by_id(id) {
        let message;
        let conditions = ` id = ?`;
        let args = [id];

        const stmt = this.#db.prepare(
            `SELECT * FROM comments WHERE` + conditions
        );
        let data = stmt.get(...args);

        let success = true;
        message = `Successfully retrieved comment associated with id ${id}`;
        if (data.length === 0) {
            success = false;
            message = `Couldn't find a comment with id ${id}`;
        }

        return { success, data, message };
    }

    add_comment({ post_id, name, email, url, comment } = {}) {
        let message;
        if (!post_id || !name || !comment) {
            message = `Failed to add comment: must specify post_id, name,` +
                `and comment`;
            this.logger.error(message);
            return {
                success: false,
                data: {},
                message: message
            };
        }

        this.logger.info(`Adding new comment for post ${post_id} to database`);

        // Get user id if the user already exists, otherwise create
        // a new user.
        let user_results = this.get_user({ name, email, url });
        if (!user_results.success) {
            user_results = this.create_user({ name, email, url });
        }

        // Now we have a user_id and a post_id
        const ts_unix_sec = Math.floor(Date.now() / 1000);

        let cols = `post_id, user_id, ts_unix_sec, comment`;
        const args = [post_id, user_id, ts_unix_sec, comment];

        const stmt = this.#db.prepare(`
            INSERT INTO comments (${cols})
                VALUES (${('?, '.repeat(args.length)).slice(0, -2)}) 
        `);

        const info = stmt.run(args);

        let success = true;
        message = `Successfully wrote new comment to database`;
        let data = {};
        if (info.changes < 1) {
            message = `Failed to write new comment to database`;
            this.logger.error(message);
            success = false;
        }

        if (success) {
            const comment_id = info.lastInsertRowid;

            data = this.get_comment_by_id(comment_id).data;

            // TODO: validate that the data in the comment is non-trivial
            if (Object.keys(data).length > 0) {
                this.logger.info(
                    `New comment with id ${comment_id} ` +
                    `has been added to database`
                );
            } else {
                this.logger.error(`Couldn't find comment associated with id`);
            }
        }

        return {
            success: success,
            data: data ?? {},
            message: message
        };
    }

    // TODO
    update_comment() {}

    // TODO
    delete_comment() {}
}

module.exports = CommentInterface;
