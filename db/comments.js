const LoggedEntity = require("../lib/LoggedEntity");

/**
 * Comments are at least names and a text string, but can also include
 * an email address and a url. All comments are associated with a post.
 *
 */
class CommentInterface extends LoggedEntity {
    #db;

    constructor(db, tag) {
        // Gives us this.logger
        super(tag);
        this.#db = db;
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

    get_user_by_comment_id(id) {
        const comment_data = this.get_comment_by_id(id);
        return this.get_user_by_id(comment_data.data.user_id);
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
        let data = stmt.all(...args);

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

    update_user(id, { name, email, url }={}) {
        let cols = ``;
        const args = [];

        if (name) {
            cols += `name = ?, `;
            args.push(name);
        }

        if (email) {
            cols += `email = ?, `;
            args.push(email);
        }

        if (url) {
            cols += `url = ?, `;
            args.push(url);
        }

        // Get rid of last ', '
        cols = cols.slice(0, -2);

        const stmt = this.#db.prepare(`
            UPDATE users SET ${cols} WHERE id = ?
        `);

        const info = stmt.run(...args);

        let success = true;
        let message = `Successfully updated user ${id}`;
        let data = {};
        if (info.changes < 1) {
            message = `Failed to update user ${id}`;
            this.logger.error(message);
            success = false;
        }

        // collect updated data
        if (success) {
            data = this.get_user_by_id(id).data;
        }

        return { success, data, message };
    }

    increment_user_comment_count(id) {
        const stmt = this.#db.prepare(`
            UPDATE users SET comment_count = comment_count + 1 WHERE id = ?
        `);

        const info = stmt.run(id);

        let success = true;
        let message = `Successfully updated comment count for user ${id}`;
        let data = {};
        if (info.changes < 1) {
            message = `Failed to update comment count for user ${id}`;
            this.logger.error(message);
            success = false;
        }

        // collect updated data
        if (success) {
            data = this.get_user_by_id(id).data;
        }

        return { success, data, message };
    }

    delete_user() {
        const stmt = this.#db.prepare(`
            DELETE FROM users WHERE id = ?
        `);
        const info = stmt.run(id);

        let success = true;
        let message = `Successully deleted user ${id} from database`;
        if (info.changes < 1) {
            message = `Failed to delete user ${id} from database`;
            this.logger.error(message);
            success = false;
        } 

        return { 
            success: success,
            data: {},
            message: message
        };
    }

    get_comment_by_id(id) {
        const stmt = this.#db.prepare(
            `SELECT * FROM comments WHERE id = ?`
        );
        let data = stmt.get(id);

        let success = true;
        let message = `Successfully retrieved comment associated with id ${id}`;
        if (data === undefined) {
            success = false;
            message = `Couldn't find a comment with id ${id}`;
            data = {};
        }

        return { success, data, message };
    }

    get_comments_by_user_id(id) {
        const stmt = this.#db.prepare(
            `SELECT * FROM comments WHERE user_id = ?` 
        );

        let data = stmt.all(id);

        let success = true;
        let message = `Successfully retrieved comments by user ${id}`;
        if (data.length === 0) {
            success = false;
            message = `Couldn't find any comments by user ${id}`;
        }

        return { success, data, message };
    }

    create_comment({ post_id, name, email, url, comment } = {}) {
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
        } else {
            this.increment_user_comment_count(user_results.data.id);
        }

        // Now we have a user_id and a post_id
        const ts_unix_sec = Math.floor(Date.now() / 1000);

        let cols = `post_id, user_id, ts_unix_sec, ` +
            `last_updated_unix_sec, comment`;
        const args = [
            post_id,
            user_results.data.id,
            ts_unix_sec,
            ts_unix_sec,
            comment
        ];

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

    update_comment(id, updated_comment) {
        const last_updated_unix_sec = Math.floor(Date.now() / 1000);

        const stmt = this.#db.prepare(`
            UPDATE comments SET comment = ?, last_updated_unix_sec = ? 
                WHERE id = ?
        `);
        const info = stmt.run(updated_comment, last_updated_unix_sec, id);

        let success = true;
        let message = `Successfully updated comment ${id}`;
        let data = {};
        if (info.changes < 1) {
            message = `Failed to update comment ${id}`;
            this.logger.error(message);
            success = false;
        }

        // collect updated data
        if (success) {
            data = this.get_comment_by_id(id).data;
        }

        return { success, data, message };
    }

    delete_comment(id) {
        const stmt = this.#db.prepare(`
            DELETE FROM comments WHERE id = ?
        `);
        const info = stmt.run(id);

        let success = true;
        let message = `Successully deleted comment ${id} from database`;
        if (info.changes < 1) {
            message = `Failed to delete comment ${id} from database`;
            this.logger.error(message);
            success = false;
        } 

        return { 
            success: success,
            data: {},
            message: message
        };
    }

    get_comments_created_after(ts_unix_sec) {
        const stmt = this.#db.prepare(
            `SELECT * FROM comments WHERE ts_unix_sec > ? ORDER BY ts_unix_sec ASC`
        );
        const data = stmt.all(ts_unix_sec);

        let message = `Successfully retrieved ${data.length} comments with ` +
            `creation timestamps exceeding ${ts_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any comments with creation timestamp " +
                `exceeding ${ts_unix_sec}`;
        }

        return { success, data, message };
    }

    get_comments_created_before(ts_unix_sec) {
        const stmt = this.#db.prepare(`
            SELECT * FROM comments 
                WHERE ts_unix_sec < ? ORDER BY ts_unix_sec ASC
        `);
        const data = stmt.all(ts_unix_sec);

        let message = `Successfully retrieved ${data.length} comments with ` +
            `creation timestamps less than ${ts_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any comments with creation timestamp " +
                `less than ${ts_unix_sec}`;
        }

        return { success, data, message };
    }

    get_comments_last_updated_after(last_updated_unix_sec) {
        const stmt = this.#db.prepare(`
            SELECT * FROM comments WHERE last_updated_unix_sec > ? 
                ORDER BY last_updated_unix_sec ASC
        `);
        const data = stmt.all(last_updated_unix_sec);

        let message = `Successfully retrieved ${data.length} comments with ` +
            `last updated timestamps exceeding ${last_updated_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any comments with last updated timestamp " +
                `exceeding ${last_updated_unix_sec}`;
        }

        return { success, data, message };
    }

    get_comments_last_updated_before(last_updated_unix_sec) {
        const stmt = this.#db.prepare(
            `SELECT * FROM comments WHERE last_updated_unix_sec < ?`
        );
        const data = stmt.all(last_updated_unix_sec);

        let message = `Successfully retrieved ${data.length} comments with ` +
            `last updated timestamps less than ${last_updated_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any comments with creation timestamp " +
                `less than ${last_updated_unix_sec}`;
        }

        return { success, data, message };
    }
}

module.exports = CommentInterface;
