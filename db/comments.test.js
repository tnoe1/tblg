const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const PostInterface = require("./posts");
const CommentInterface = require("./comments");

const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

// This should be deleted after tests are run
const TEST_DB_DIR = join(__dirname, 'data/comments_test');
if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });

const TEST_DB_PATH = join(TEST_DB_DIR, 'tblg_test.db');
const MIGRATIONS_PATH = join(__dirname, 'migrations');

class MigrationError extends Error {
    constructor(message, version, db_error) {
        super(message);
        this.name = "MigrationError";
        this.version = version;
        this.cause = db_error;
    }
}

const logger = {
    info: (s) => null,
    warn: (s) => null,
    error: (s) => null
};

const create_test_db = () => {
    /**
     * Convert a list of three integers to a decimal value
     */
    const decimalize = ([d1, d2, d3]) => 100 * d1 + 10 * d2 + d3;
    
    /**
     * Get the list of migration files from db/migrations.
     */
    const get_migrations = () => fs.readdirSync(MIGRATIONS_PATH);
    
    /**
     * Get migration files in sorted order
     */
    const get_sorted_migrations = () => {
        return get_migrations().map((v) => v.split('.')[0].split('_').map((n) => +n)).sort((a, b) => {
            // 'major.minor.patch'. For ascending, a - b should produce a 
            // negative number. For descending b - a should produce a negative 
            // number. Converting versions to decimal digit values for comparison.
            return decimalize(a) - decimalize(b);
        }).map((v) => v.map((n) => String(n)).join('_').concat('.sql'));
    };
    
    /**
     * Run a migration
     */
    const run_migration = (db, m) => {
        try {
            // Apply m to db.
            const m_str = fs.readFileSync(join(__dirname, 'migrations', m), 'utf8');
    
            // parse the sql commands (removing comments) and build the transaction
            const sql_cmds = m_str
                .replace(/^--.*$/gm, "").split(';')
                .map((s) => s.trim()).filter((s) => !!s); // Filter gets rid of ''

            const run_mig = db.transaction(() => {
                for (const c of sql_cmds) db.prepare(c).run();
            });
    
            run_mig();
        } catch (error) {
            // Delete db file and hard error
            fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
            throw new MigrationError(
                "Failed to initialize database with migration files",
                m.split('.')[0],
                error
            );
        }
    }; 
    
    const db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL'); // Recommended for performance
    
    const migrations = get_sorted_migrations();
    // Initialize from migrations
    for (const m of migrations) {
        logger.info(`applying v${m.split('.')[0]} changes`);
        run_migration(db, m);
    }

    return db;
};

const destroy_test_db = () => {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
};

describe("CommentInterface", async (t) => {
    // Setup
    let post_interface;
    let comment_interface;
    before(() => {
        const db = create_test_db();
        comment_interface = new CommentInterface(db, "comments-interface");
        post_interface = new PostInterface(db, "posts-interface");

        // dummify the loggers
        comment_interface.logger = logger;
        post_interface.logger = logger;
    });

    let init_post_id;
    let init_comment_id;
    it("creates comments", () => {
        const post_data = post_interface.create_post({
            author: "Thomas Noel",
            content: "I love Susannah!!!",
            categories: ["Love", "Family"]
        });

        const comment_data = comment_interface.create_comment({
            post_id: post_data.data.id,
            name: "Jeff Jeffingston",
            email: "jeff@jeffytown.gov",
            url: "jeffytown.gov",
            comment: "That's a good thing."
        });

        assert.strictEqual(comment_data.success, true);
        assert.strictEqual(comment_data.data.comment, "That's a good thing.");

        init_post_id = post_data.data.id;
        init_comment_id = comment_data.data.id; 

        const alt_cd = comment_interface.get_comment_by_id(init_comment_id);

        assert.strictEqual(alt_cd.data.comment, "That's a good thing.");
    });

    let init_user_id;
    it("can get user associated with a comment", () => {
        const user_data = comment_interface.get_user_by_comment_id(
            init_comment_id
        );

        init_user_id = user_data.data.id;

        assert.strictEqual(user_data.data.name, "Jeff Jeffingston");
    });

    it("can get comments by user", () => {
        const comments_data = comment_interface.get_comments_by_user_id(
            init_user_id
        );

        assert.strictEqual(comments_data.data.length, 1);
        assert.strictEqual(
            comments_data.data[0].comment,
            "That's a good thing."
        );
    });

    let init_ts;
    let second_comment;
    it("can get comments created after specified ts", async () => {
        // Make sure we generate a timestamp that is newer than that
        // associated with previous entries.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        init_ts = Math.floor(Date.now() / 1000);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));

        second_comment = comment_interface.create_comment({
            post_id: init_post_id, 
            name: "Tom Tomingston",
            email: "tom@tommytown.eu",
            url: "tommytown.eu",
            comment: "I love the United States."
        }).data;

        comment_interface.create_comment({
            post_id: init_post_id, 
            name: "Tim Timingston",
            email: "tim@timmytown.eu",
            url: "timmytown.eu",
            comment: "I love Canada."
        });

        const fresh_comments = comment_interface.get_comments_created_after(
            init_ts
        );
        const user_data = comment_interface.get_user_by_comment_id(
            fresh_comments.data[0].id
        );
        assert.strictEqual(fresh_comments.data.length, 2);
        assert.strictEqual(user_data.data.name, "Tom Tomingston");
    });

    it("can get comments created before specified ts", () => {
        const old_comments = comment_interface.get_comments_created_before(
            init_ts
        );
        assert.strictEqual(old_comments.data.length, 1);
    });

    it("can delete a comment with a specified id", () => {
        const orig_comment = comment_interface.get_comment_by_id(
            second_comment.id
        );
        assert.strictEqual(orig_comment.success, true);
        assert.strictEqual(orig_comment.data.id, second_comment.id);

        const info = comment_interface.delete_comment(second_comment.id);
        assert.strictEqual(info.success, true);

        const deleted_comment = comment_interface.get_comment_by_id(
            second_comment.id
        );
        assert.strictEqual(deleted_comment.success, false);
        assert.strictEqual(typeof deleted_comment.data, 'object');
        assert.strictEqual(Object.keys(deleted_comment.data).length, 0);

        // delete comment that doesn't exist
        const fake_info = comment_interface.delete_comment(100);
        assert.strictEqual(fake_info.success, false);
    });

    let split_ts;
    let aug_id;
    it("can update existing comments", async () => {
        const aug_data = comment_interface.create_comment({
            post_id: init_post_id, 
            name: "St. Augustine",
            email: "auggy@auggytown.ro",
            url: "auggytown.ro",
            comment: "ordo amoris."
        });

        assert.strictEqual(aug_data.data.comment, "ordo amoris.");

        const original_last_updated_ts = aug_data.data.last_updated_unix_sec;

        await new Promise((resolve) => setTimeout(resolve, 1000));
        split_ts = Math.floor(Date.now() / 1000);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const updated_data = comment_interface.update_comment(
            aug_data.data.id,
            "ordered loves"
        );

        assert.strictEqual(updated_data.success, true);
        assert.strictEqual(updated_data.data.comment, "ordered loves");

        const updated_ts = updated_data.data.last_updated_unix_sec;
        assert.notStrictEqual(original_last_updated_ts, updated_ts);

        aug_id = updated_data.data.id;
    });

    it("can get comments last updated after ts", () => {
        const recently_updated = comment_interface.get_comments_last_updated_after(split_ts);
        assert.strictEqual(recently_updated.success, true);
        assert.strictEqual(recently_updated.data.length, 1);
        assert.strictEqual(recently_updated.data[0].id, aug_id);
        assert.strictEqual(recently_updated.data[0].comment, "ordered loves");
    });

    it("can get comments last updated before ts", () => {
        const past_updated = comment_interface.get_comments_last_updated_before(split_ts);
        assert.strictEqual(past_updated.success, true);
        assert.strictEqual(past_updated.data.length, 2);
    });

    after(() => {
        destroy_test_db();
    });
});
