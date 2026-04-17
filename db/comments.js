
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

    create_user({ name, email, url } = {}) {
        let fields = "name";
        let qms = "?";
        let args = [name];
        if (email) {
            fields += ", email";
            qms += ", ?";
            args.push(email);
        }

        if (url) {
            fields += ", url";
            qms += ", ?";
            args.push(url);
        } 

        const stmt = this.#db.prepare(`
            INSERT INTO users (${fields}) VALUES (${qms})
        `);
        const info = stmt.run(...args);

        let success = true;
        let message = "Successfully created new user";
        if (info.changes < 1) {
            message = "Failed to create new user";
            this.logger.error(message);
            success = false;
        }

        if (success) {
            const user_id = info.lastInsertRowid;
            
            // TODO: Query user by id, and return the object as "data"
        }
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
        if (!success) {
            // TODO: Figure out what create_user returns and continue adding 
            // comment.
            this.create_user({ name, email, url });
        }

        // TODO 
    }
}

module.exports = CommentInterface;
