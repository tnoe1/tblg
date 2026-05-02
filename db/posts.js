const LoggedEntity = require("../lib/LoggedEntity");

class CategoryAssociationError extends Error {
    constructor(message, post_id, categories, error) {
        super(message);
        this.name = "CategoryAssociationError";
        this.post_id = post_id;
        this.category = categories;
        this.cause = error;
    }
}

/**
 * Posts are html strings (MathML for math rendering), a date, an author,
 * and one or more categories. 
 * Any logic related to posts gets encapsulated here.
 *
 */
class PostInterface extends LoggedEntity {
    #db;

    constructor(db, tag) {
        // Gives us this.logger
        super(tag);
        this.#db = db;
    }

    associate_categories(post_id, categories) {
        const stmt = this.#db.prepare(`
            INSERT INTO post_categories (post_id, category) VALUES (?, ?)
        `);

        try {
            const categorize_post = this.#db.transaction((cs) => {
                for (const c of cs) stmt.run(post_id, c.toLowerCase());
            });

            categorize_post(categories);
        } catch (error) {
            throw new CategoryAssociationError(
                "Failed to associate categories with post",
                post_id,
                categories,
                error
            );
        }
    }

    /**
     * Create a post.
     */
    create_post({ author, content, parent_id, categories } = {}) {
        let message;
        if (!author || !content) {
            message = `Failed to create post: must specify author and content`;
            this.logger.error(message);
            return {
                success: false,
                data: {},
                message: message
            };
        }

        this.logger.info(`Adding new post to database`);

        const ts_unix_sec = Math.floor(Date.now() / 1000);

        // At creation, last_updated ts === creation ts
        let cols = `ts_unix_sec, last_updated_unix_sec, author, content`;
        const args = [ts_unix_sec, ts_unix_sec, author, content];

        // If parent_id has been stipulated make sure that it gets inserted
        if (parent_id) {
            cols += `, parent`; 
            args.push(+parent_id);
        }

        const stmt = this.#db.prepare(`
            INSERT INTO posts (${cols}) 
                VALUES (${('?, '.repeat(args.length)).slice(0, -2)})
        `);

        const info = stmt.run(args);

        let success = true;
        message = "Successully wrote post to database";
        let data = {};
        if (info.changes < 1) {
            message = "Failed to write post to database";
            this.logger.error(message);
            success = false;
        } 

        // If write successful, get row data for return
        if (success) {
            const post_id = info.lastInsertRowid;

            if (categories) this.associate_categories(post_id, categories);

            data = this.get_post_by_id(post_id).data;

            if (Object.keys(data).length > 0) {
                data.categories = categories;
                this.logger.info(
                    `New post with id ${post_id} successfully added to database`
                );
            } else {
                this.logger.error(`Couldn't find id associated with post`);
            }
        }

        return {
            success: success,
            data: data ?? {},
            message: message
        };
    }

    /**
     * Gets post associated with id. Returns post object if a post
     * with the associated id exists, otherwise, returns undefined.
     */
    get_post_by_id(id) {
        const stmt = this.#db.prepare(`SELECT * FROM posts WHERE id = ?`);
        let data = stmt.get(id);

        let message = `Successfully retrieved post with id ${id}`;
        let success = true;
        if (data === undefined) {
            success = false;
            message = `Couldn't find a post with id ${id}`;
            data = {};
        }

        return { success, data, message };
    }

    get_posts_by_author(author) {
        const stmt = this.#db.prepare(`SELECT * FROM posts WHERE author = ?`);
        const data = stmt.all(author);

        let message = `Successfully retrieved ${data.length} posts with ` +
            `author ${author}`;
        let success = true;
        if (data.length === 0) {
            message = `Couldn't find any posts with author ${author}`;
        }

        return { success, data, message };
    }

    get_posts_created_after(ts_unix_sec) {
        const stmt = this.#db.prepare(
            `SELECT * FROM posts WHERE ts_unix_sec > ? ORDER BY ts_unix_sec ASC`
        );
        const data = stmt.all(ts_unix_sec);

        let message = `Successfully retrieved ${data.length} posts with ` +
            `creation timestamps exceeding ${ts_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any posts with creation timestamp " +
                `exceeding ${ts_unix_sec}`;
        }

        return { success, data, message };
    }

    get_posts_created_before(ts_unix_sec) {
        const stmt = this.#db.prepare(
            `SELECT * FROM posts WHERE ts_unix_sec < ? ORDER BY ts_unix_sec ASC`
        );
        const data = stmt.all(ts_unix_sec);

        let message = `Successfully retrieved ${data.length} posts with ` +
            `creation timestamps less than ${ts_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any posts with creation timestamp " +
                `less than ${ts_unix_sec}`;
        }

        return { success, data, message };
    }

    get_posts_last_updated_after(last_updated_unix_sec) {
        const stmt = this.#db.prepare(`
            SELECT * FROM posts WHERE last_updated_unix_sec > ? 
                ORDER BY last_updated_unix_sec ASC
        `);
        const data = stmt.all(last_updated_unix_sec);

        let message = `Successfully retrieved ${data.length} posts with ` +
            `last updated timestamps exceeding ${last_updated_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any posts with last updated timestamp " +
                `exceeding ${last_updated_unix_sec}`;
        }

        return { success, data, message };
    }

    get_posts_last_updated_before(last_updated_unix_sec) {
        const stmt = this.#db.prepare(
            `SELECT * FROM posts WHERE last_updated_unix_sec < ?`
        );
        const data = stmt.all(last_updated_unix_sec);

        let message = `Successfully retrieved ${data.length} posts with ` +
            `last updated timestamps less than ${last_updated_unix_sec}`;
        let success = true;
        if (data.length === 0) {
            message = "Couldn't find any posts with creation timestamp " +
                `less than ${last_updated_unix_sec}`;
        }

        return { success, data, message };
    }

    get_posts_of_category(category) {
        const stmt = this.#db.prepare(
            `SELECT * FROM posts as p 
                LEFT JOIN post_categories as pc ON p.id = pc.post_id 
                WHERE pc.category = ?`
        );
        const data = stmt.all(category.toLowerCase());

        let message = `Successfully retrieved ${data.length} posts with ` +
            `category ${category}`;
        let success = true;
        if (data.length === 0) {
            message = `Couldn't find any posts with category ${category}`;
        }

        return { success, data, message };
    }

    get_parent_of(id) {
        const child_post = this.get_post_by_id(id);

        let success = true;
        let message = `Successfully retrieved parent of post ${id}`;
        if (child_post.data.parent === null) {
            success = false;
            message = `Failed to retrieve parent of post ${id}: has no parent`;
            this.logger.error(message);
        }

        let data = {};
        if (success) {
            data = this.get_post_by_id(child_post.data.parent).data; 
        }

        return { success, data, message };
    }

    delete_post(id) {
        const stmt = this.#db.prepare(`
            DELETE FROM posts WHERE id = ?
        `);
        const info = stmt.run(id);

        let success = true;
        let message = `Successully deleted post ${id} from database`;
        if (info.changes < 1) {
            message = `Failed to delete post ${id} from database`;
            this.logger.error(message);
            success = false;
        } 

        return { 
            success: success,
            data: {},
            message: message
        };
    }

    update_post(id, updated_content) {
        const last_updated_unix_sec = Math.floor(Date.now() / 1000);

        const stmt = this.#db.prepare(`
            UPDATE posts SET content = ?, last_updated_unix_sec = ? 
                WHERE id = ?
        `);
        const info = stmt.run(updated_content, last_updated_unix_sec, id);

        let success = true;
        let message = `Successfully updated post ${id}`;
        let data = {};
        if (info.changes < 1) {
            message = `Failed to update post ${id}`;
            this.logger.error(message);
            success = false;
        }

        // collect updated data
        if (success) {
            data = this.get_post_by_id(id).data;
        }

        return { success, data, message };
    }
}

module.exports = PostInterface;
