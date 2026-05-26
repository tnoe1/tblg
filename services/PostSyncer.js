const fs = require("node:fs/promises");
const path = require("node:path");

const compute_checksum = require("../lib/compute_checksum");
const LoggedEntity = require("../lib/LoggedEntity");
const Transpiler = require("../lib/Transpiler");

class MissingAttributionError extends Error {
    constructor(message, md_path) {
        super(message);
        this.name = "MissingAttributionError";
        this.md_path = md_path;
    }
}

/**
 * Synchronize posts currently in database with the posts present in 
 * views/posts.
 */
class PostSyncer extends LoggedEntity {
    #db_interface;

    static get POST_PATH() { return "views/posts"; }

    constructor(db_interface) {
        super("post-syncer");

        this.#db_interface = db_interface;
        this.transpiler = new Transpiler();
    }

    async _get_db_checksum_map() {
        const res = this.#db_interface.posts.get_post_ids();

        if (!res.success) {
            const error_message = `Failed to retrieve post ids`;
            this.logger.error(error_message);
            throw new Error(error_message);
        }

        let entries = [];
        for (const id of res.data) {
            let post = this.#db_interface.posts.get_post_by_id(id).data;
            entries.push([post.md_path, {
                id: id,
                checksum: post.md_checksum
            }]);
        }

        return Object.fromEntries(entries);
    }

    async _get_file_checksum_map() {
        const entries = await fs.readdir(
            PostSyncer.POST_PATH,
            { withFileTypes: true }
        );
        const files = entries.filter((e) => e.isFile());
        const paths = files.map((f) => path.join(
            PostSyncer.POST_PATH,
            f.name
        ));
        const checksums = await Promise.all(
            paths.map((p) => compute_checksum(p))
        );

        return Object.fromEntries(
            paths.map((p, idx) => [p, checksums[idx]])
        );
    }

    _compute_disjoint_decomposition(db_checksum_map, file_checksum_map) {
        // Use sets so that we have O(1) membership checks
        const disk_paths = new Set(Object.keys(file_checksum_map));
        const db_paths = new Set(Object.keys(db_checksum_map));

        const only_on_disk = Object.keys(file_checksum_map).filter(
            (x) => !db_paths.has(x)
        );
        const in_both = Object.keys(db_checksum_map).filter(
            (x) => disk_paths.has(x)
        );

        // Entries instead of just array of keys
        const only_in_db = Object.entries(db_checksum_map).filter(
            (e) => !disk_paths.has(e[0])
        );

        return { only_in_db, only_on_disk, in_both };
    }

    async _preprocess_post(md_path) {
        const tag_symbol = "@!";

        let md = null;
        let author = null;
        let parent_id = null;
        let categories = [];
        try {
            md = await fs.readFile(md_path, 'utf8');
            let lines = md.split("\n");
            md = lines.filter((l) => !l.startsWith(tag_symbol)).join("\n");

            let tag_lines = lines.filter((l) => l.startsWith(tag_symbol));

            this.logger.info(`In post ${md_path}, found tags: `);
            for (const tl of tag_lines) {
                const tag = tl.split(" ")[0].split("!")[1];

                switch (tag) {
                    case "author":
                        author = JSON.parse(tl.split(" ").slice(1).join(" "));
                        this.logger.info(`    author: ${author}`);
                        break;
                    case "parent":
                        parent_id = +(tl.split(" ").slice(1));
                        this.logger.info(`    parent_id: ${parent_id}`);
                        break;
                    case "categories":
                        categories = JSON.parse(
                            tl.split(" ").slice(1).join(" ")
                        );
                        this.logger.info(`    categories: ${categories}`);
                        break;
                    default:
                        this.logger.warning(
                            `Tag type ${tag} is unsupported: seen in ${md_path}`
                        );
                }
            }

            // Need to specify an author
            if (author === null) {
                this.logger.error(
                    `No attribution in post: ${md_path}. Please place ` +
                    `an @author attribution at top of post file. (e.g. ` +
                    `"@author Dave Smith")`
                );
                throw new MissingAttributionError(
                    "Missing an @author tag at beginning of post md file",
                    md_path
                );
            }

        } catch (err) {
            this.logger.error(`Failed to preprocess md at ${md_path}: ${err}`);
        }

        return {
            post: md,
            author: author,
            parent_id: parent_id,
            categories: categories
        };
    }

    _get_header_string(author, parent_id, categories) {
        let headers = { author };

        if (parent_id !== null) headers.parent = parent_id;
        if (categories.length > 0) headers.categories = categories;

        let header_parts = [];
        for (const [h_name, value] of Object.entries(headers)) {
            header_parts.push(`@!${h_name} ${JSON.stringify(value)}`);
        }

        return header_parts.join('\n');
    }

    async _update_desynced_post(post_id, md_path) {
        this.logger.info(
            `Markdown post at ${md_path} has changed since last ` +
            `sync. Rebuilding and syncing updated post.`
        );

        let md = null;
        let author = null;
        let parent_id = null;
        let categories = [];
        try {
            let post_info = await this._preprocess_post(md_path);
            md = post_info.post;
            author = post_info.author;
            parent_id = post_info.parent_id;
            categories = post_info.categories;
        } catch (err) {
            this.logger.error(`Failed to update md at ${md_path}: ${err}`);
            return;
        }

        let post_html = await this.transpiler.md_to_html(md);

        let res = await this.#db_interface.posts.update_post(
            post_id,
            md_path,
            post_html,
            author,
            parent_id,
            categories
        );

        if (!res.success) this.logger.error(
            `Failed to update post ${post_id} at ${md_path}: ${res.message}`
        );
    }

    async _create_new_post_from_md(md_path) {
        let md = null;
        let author = null;
        let parent_id = null;
        let categories = [];
        try {
            let post_info = await this._preprocess_post(md_path);
            md = post_info.post;
            author = post_info.author;
            parent_id = post_info.parent_id;
            categories = post_info.categories;
        } catch (err) {
            this.logger.error(`Failed to create md at ${md_path}: ${err}`);
            return;
        }

        let post_html = await this.transpiler.md_to_html(md);

        let res = await this.#db_interface.posts.create_post({
            author: author,
            content: post_html,
            md_path: md_path,
            parent_id: parent_id,
            categories: categories
        });

        if (res.success) {
            this.logger.info(
                `Post at ${md_path} added to database with id ${res.data.id}`
            );
        } else {
            this.logger.info(
                `Failed to add post at ${md_path} added to database: ` +
                `${res.message}`
            );
        }
    }

    async _recover_md_from_html(post_id) {
        // At this point, we shouldn't have a problem retrieving this, so
        // it's ok, to just grab .data from the returned object.
        const post = this.#db_interface.posts.get_post_by_id(post_id).data;

        this.logger.warn(
            `Couldn't find post markdown file that should be at ` +
            `${post.md_path}. Attempting to recovering md from db html...`
        );

        let post_md = await this.transpiler.html_to_md(post.content);
        let categories = this.#db_interface.posts.get_associated_categories(
            post_id
        );

        // Compute header string and inject it into markdown
        let header_string = this._get_header_string(
            post.author,
            post.parent,
            categories.data
        );
        post_md = [header_string, post_md].join('\n');

        try {
            await fs.writeFile(post.md_path, post_md);
        } catch (err) {
            this.logger.error(
                `Failed to write transpiled content to disk at ` +
                `${post.md_path}: ${err}`
            );
        }

        this.logger.info(
            `Post markdown recovery from database successful for ` + 
            `${post.md_path}`
        );
    }

    async synchronize_posts() {
        this.logger.info(`Starting post synchronization`);

        const db_checksum_map = await this._get_db_checksum_map();
        const file_checksum_map = await this._get_file_checksum_map();

        const disjoint_decomp = this._compute_disjoint_decomposition(
            db_checksum_map,
            file_checksum_map
        );

        const desynced = disjoint_decomp.in_both.filter(
            (p) => (db_checksum_map[p].checksum !== file_checksum_map[p])
        );

        // Update desynced
        for (const p of desynced) {
            await this._update_desynced_post(db_checksum_map[p].id, p);
        }

        // Create new posts that are on disk, but not in db
        for (const p of disjoint_decomp.only_on_disk) {
            await this._create_new_post_from_md(p);
        }

        // Recover filesystem markdown from posts that have html content,
        // but are missing associated markdown.
        for (const [p, info] of disjoint_decomp.only_in_db) {
            await this._recover_md_from_html(info.id);
        }

        this.logger.info(`Post synchronization complete`);
    }
}

module.exports = PostSyncer;
