const compute_checksum = require("../lib/compute_checksum");
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

class MarkdownHashingError extends Error {
    constructor(message, md_path, error) {
        super(message);
        this.name = "MarkdownHashingError";
        this.md_path = md_path;
        this.cause = error;
    }
}

class InvalidParentError extends Error {
    constructor(message, md_path, parent_id) {
        super(message);
        this.name = "InvalidParentError";
        this.md_path = md_path;
        this.parent_id = parent_id;
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
        if (categories.length === 0) return;

        const stmt = this.#db.prepare(`
            INSERT INTO post_categories (post_id, category) VALUES (?, ?)
        `);

        try {
            const categorize_post = this.#db.transaction((cs) => {
                for (const c of cs) stmt.run(post_id, c.toLowerCase());
            });

            categorize_post(categories);
        } catch (err) {
            throw new CategoryAssociationError(
                "Failed to associate categories with post",
                post_id,
                categories,
                err
            );
        }
    }

    /**
     * Clear all categories associated with specified post.
     */
    clear_categories(post_id) {
        const stmt = this.#db.prepare(`
            DELETE FROM post_categories WHERE post_id = ?
        `);

        stmt.run(post_id);
    }

    /**
     * Create a post. Assumes that `content` is pre-transpiled .html (from .md).
     */
    async create_post({ author, content, md_path, parent_id, categories } = {}) {
        let message;
        if (!author || !content || !md_path) {
            message = `Failed to create post: must specify author, ` +
                `content, and md_path`;
            this.logger.error(message);
            return {
                success: false,
                data: {},
                message: message
            };
        }

        this.logger.info(`Adding new post to database`);

        const ts_unix_sec = Math.floor(Date.now() / 1000);

        let md_checksum;
        try {
            md_checksum = await compute_checksum(md_path, 'sha256');
        } catch (err) {
            this.logger.error(`Failed to hash markdown file: ${md_path}`);
            throw new MarkdownHashingError(
                `Failed to hash markdown file`,
                md_path,
                err
            );
        }

        // At creation, last_updated ts === creation ts
        let cols = `ts_unix_sec, last_updated_unix_sec, ` +
            `author, content, md_path, md_checksum`;
        const args = [
            ts_unix_sec,
            ts_unix_sec,
            author,
            content,
            md_path,
            md_checksum
        ];

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

    get_post_ids() {
        // No need for DISTINCT since id is primary key
        const data = this.#db.prepare(
            `SELECT id FROM posts ORDER BY id ASC`
        ).all().map((obj) => obj.id);

        let message = `Successfully retrieved ${data.length} post ids`;
        let success = true;
        if (data.length === 0) {
            message = `Couldn't find any post ids`;
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

    /**
     * Update the post associated with the given id and md_path.
     *
     * @param {Number} id - the post id
     * @param {String} md_path - path to the post markdown file
     * @param {String} updated_content - transpiled post html
     * @param {String} updated_author - author associated with updated post
     * @param {Number} parent_id - the id of the parent post
     * @param {Array} categories - post categories
     *
     * @returns {Object} the updated post object
     */
    async update_post(
        id,
        md_path,
        updated_content,
        updated_author,
        parent_id,
        categories
    ) {
        if (!id || !md_path) {
            message = `Failed to update post: must specify id and md_path`;
            this.logger.error(message);
            return {
                success: false,
                data: {},
                message: message
            };
        }

        const last_updated_unix_sec = Math.floor(Date.now() / 1000);

        let md_checksum;
        try {
            md_checksum = await compute_checksum(md_path, 'sha256');
        } catch (err) {
            this.logger.error(`Failed to hash markdown file: ${md_path}`);
            throw new MarkdownHashingError(
                `Failed to hash markdown file`,
                md_path,
                err
            );
        }

        if (parent_id !== null && parent_id !== undefined) {
            parent_post = await this.get_post_by_id(parent_id);
            if (!parent_post.success) {
                this.logger.error(`Invalid parent_id specified: ${parent_id}`);
                throw new InvalidParentError(
                    "Specified parent post doesn't exist",
                    md_path,
                    parent_id
                );
            }
        }

        // At creation, last_updated ts === creation ts
        let cols = `md_path = ?, md_checksum = ?, content = ?, ` +
            `author = ?, last_updated_unix_sec = ?`;
        const args = [
            md_path,
            md_checksum,
            updated_content,
            updated_author,
            last_updated_unix_sec
        ];

        // If parent_id has been stipulated make sure that it gets inserted
        if (parent_id) {
            cols += `, parent = ?`;
            args.push(+parent_id);
        }

        const stmt = this.#db.prepare(`
            UPDATE posts SET ${cols} WHERE id = ?
        `);

        const info = stmt.run([...args, id]);

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
            if (categories && categories.length > 0) { 
                this.clear_categories(id);
                this.associate_categories(id, categories);
            }

            data = this.get_post_by_id(id).data;
        }

        return { success, data, message };
    }
}

module.exports = PostInterface;
