
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
class PostInterface {
    #db;

    constructor(db, logger) {
        this.#db = db;
        this.logger = logger;
    }

    associate_categories(post_id, categories) {
        const stmt = this.#db.prepare(`
            INSERT INTO post_categories (post_id, category) VALUES (?, ?)
        `);

        try {
            const categorize_post = this.#db.transaction((cs) => {
                for (const c of cs) stmt.run(post_id, c);
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

    create_post({ author, content, parent_id, categories } = {}) {
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
            INSERT INTO posts (${cols}) VALUES (${('?, '.repeat(args.length)).slice(0, -2)})
        `);

        const info = stmt.run(args);

        let success = true;
        let message = "Successully wrote post to database";
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

            // Query db for post
            const query_stmt = this.#db.prepare(`SELECT * FROM posts WHERE id = ?`);

            // Returns undefined if statement was valid, but id not in table
            data = query_stmt.get(post_id);

            if (!!data) {
                data.categories = categories;
                this.logger.info(`New post with id ${post_id} successfully added to database`);
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

    get_post_by_id(id) {}

    get_posts_by_author(author) {}

    get_posts_after(ts_unix_sec) {}

    get_posts_before(ts_unix_sec) {}

    get_posts_of_category(category) {}

    get_parent_of(id) {}

    update_post() {}

    delete_post() {}
}

module.exports = PostInterface;
