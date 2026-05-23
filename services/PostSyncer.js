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
        const POST_PATH = "views/posts";

        const entries = await fs.readdir(POST_PATH, { withFileTypes: true });
        const files = entries.filter((e) => e.isFile());
        const paths = files.map((f) => path.join(POST_PATH, f.name));
        const checksums = await Promise.all(
            paths.map((p) => compute_checksum(p))
        );

        return  Object.fromEntries(
            paths.map((p, idx) => [p, checksums[idx]])
        );
    }

    _compute_disjoint_decomposition(db_checksum_map, file_checksum_map) {
        // Use sets so that we have O(1) membership checks
        const disk_paths = new Set(Object.keys(file_checksum_map));
        const db_paths = new Set(Object.keys(db_checksum_map));

        const only_in_db = Object.keys(db_checksum_map).filter(
            (x) => !disk_paths.has(x)
        );
        const only_on_disk = Object.keys(file_checksum_map).filter(
            (x) => !db_paths.has(x)
        );
        const in_both = Object.keys(db_checksum_map).filter(
            (x) => disk_paths.has(x)
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
                        author = tl.split(" ").slice(1).join(" "); 
                        this.logger.info(`\tauthor: ${author}`);
                        break;
                    case "parent":
                        parent_id = +(tl.split(" ").slice(1));
                        this.logger.info(`\tparent_id: ${parent_id}`);
                        break;
                    case "categories":
                        categories = JSON.parse(tl.split(" ").slice(1));
                        this.logger.info(`\tcategories: ${categories}`);
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
            this.logger.error(`Failed to preprocess md at ${md}: ${err}`);
        }

        return {
            post: md,
            author: author,
            parent_id: parent_id,
            categories: categories
        };
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

        // Need to:
        //     i)   [x] update desynced
        //     ii)  [ ] create posts for `only_on_disk`
        //     iii) [ ] decide what to do for `only_in_db`. I don't know if 
        //          deletion makes sense here... Probably log a warning and
        //          save the html in a backup directory in the views
        //          folder. Could also look at reverse transpiling.
        
        // Update desynced
        for (const p of desynced) {
            let post_id = db_checksum_map[p].id;

            let md = null;
            let author = null;
            let parent_id = null;
            let categories = [];
            try {
                let post_info = await this._preprocess_post(p);
                md = post_info.post;
                author = post_info.author;
                parent_id = post_info.parent_id;
                categories = post_info.categories;
            } catch (err) {
                this.logger.error(`Failed to update md at ${md_path}: ${err}`);
                continue;
            }

            let post_html = await this.transpiler.md_to_html(md);

            let res = await this.#db_interface.update_post(
                db_checksum_map[p].id,
                p,
                post_html,
                author,
                parent_id,
                categories
            );

            if (!res.success) this.logger.error(
                `Failed to update post ${post_id} at ${p}: ${res.message}`
            );
        }

        // Create new posts that are on disk, but not in db
        for (const p of Object.keys(disjoint_decomp.only_on_disk)) {
            let md = null;
            let author = null;
            let parent_id = null;
            let categories = null;
            // TODO: finish this case and add parent_id and categories to 
            // post creation below.
            try {
                let post_info = await this._preprocess_post(p);
                md = post_info.post;
                author = post_info.author;
            } catch (err) {
                this.logger.error(`Failed to create md at ${md_path}: ${err}`);
                continue;
            }

            let results = await this.#db_interface.create_post({
                author: author,
                content: md,
                md_path: p,
            });
        }

        // TODO! Iterate through the posts in the db and compute checksums
        // of the posts at the md_path of each to see if they still match.
        // If they don't, then update the post with the new transpiled content
        // and md_checksum.

        console.log(paths, db_md_paths);
    }
}

module.exports = PostSyncer;
