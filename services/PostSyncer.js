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
        //     i)   update desynced
        //     ii)  create posts for `only_on_disk`
        //     iii) decide what to do for `only_in_db`. I don't know if 
        //          deletion makes sense here... Probably log a warning and
        //          save the html in a backup directory in the views
        //          folder. Could also look at reverse transpiling.
        
        // Update desynced
        for (const p of desynced) {
            let post_id = db_checksum_map[p].id;

            // TODO: Transpile md to html (pick tool, etc..)
            // mathpix-markdown-it?

            let res = await this.#db_interface.update_post(
                db_checksum_map[p].id,
                p,
                transpiled_md
            );

            if (!res.success) this.logger.error(
                `Failed to update post ${post_id} at ${p}`
            );
        }

        // TODO! Iterate through the posts in the db and compute checksums
        // of the posts at the md_path of each to see if they still match.
        // If they don't, then update the post with the new transpiled content
        // and md_checksum.

        console.log(paths, db_md_paths);
    }
}

module.exports = PostSyncer;
