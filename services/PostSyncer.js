const fs = require("node:fs/promises");
const path = require("node:path");

const compute_checksum = require("../lib/compute_checksum");
const LoggedEntity = require("../lib/LoggedEntity");

/**
 * Synchronize posts currently in database with the posts present in 
 * views/posts.
 */
class PostSyncer extends LoggedEntity {
    #db_interface;

    constructor(db_interface) {
        super("post-syncer");

        this.#db_interface = db_interface;
    }

    async get_db_md_paths() {
        const res = this.#db_interface.posts.get_post_ids();
        
        if (!res.success) {
            const error_message = `Failed to retrieve post ids`;
            this.logger.error(error_message);
            throw new Error(error_message);
        }

        return res.data.map(
            (id) => this.#db_interface.posts.get_post_by_id(id).data.md_path
        );
    }

    async synchronize_posts() {
        const POST_PATH = "views/posts";

        this.logger.info(`Starting post synchronization`);

        const entries = await fs.readdir(POST_PATH, { withFileTypes: true });
        const files = entries.filter((e) => e.isFile());
        const paths = files.map((f) => path.join(POST_PATH, f.name));
        const checksums = await Promise.all(
            paths.map((p) => compute_checksum(p))
        );
        const checksum_map = Object.fromEntries(
            paths.map((p, idx) => [p, checksums[idx]])
        );

        const db_md_paths = await this.get_db_md_paths();

        // TODO! Iterate through the posts in the db and compute checksums
        // of the posts at the md_path of each to see if they still match.
        // If they don't, then update the post with the new transpiled content
        // and md_checksum.
        console.log(paths, db_md_paths);

    }
}

module.exports = PostSyncer;
