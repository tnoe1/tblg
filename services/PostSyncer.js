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

    async synchronize_posts() {
        this.logger.info(`Starting post synchronization`);
        // TODO! Iterate through the posts in the db and compute checksums
        // of the posts at the md_path of each to see if they still match.
        // If they don't, then update the post with the new transpiled content
        // and md_checksum.
    }
}

module.exports = PostSyncer;
