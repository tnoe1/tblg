const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

const LoggedEntity = require("../lib/LoggedEntity");
const PostInterface = require("./posts");
const CommentInterface = require("./comments");


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

class DBInitializer extends LoggedEntity {
    constructor(db_path, mig_path) {
        super("tblgdb");
        this.db_path = db_path;
        this.mig_path = mig_path;

        this.db = null;

        // Destroy the log messages
        this.logger = logger;
    }

    /**
     * Convert a list of three integers to a decimal value
     */
    _decimalize([d1, d2, d3]) {
        return 100 * d1 + 10 * d2 + d3;
    }
    
    /**
     * Get the list of migration files from db/migrations.
     */
    _get_migrations() {
        return fs.readdirSync(MIGRATIONS_PATH); 
    }
    
    /**
     * Get migration files in sorted order
     */
    _get_sorted_migrations = () => {
        return this._get_migrations()
            .map((v) => v.split('.')[0].split('_').map((n) => +n))
            .sort((a, b) => {
                // 'major.minor.patch'. For ascending, a - b should produce a 
                // negative number. For descending b - a should produce a 
                // negative number. Converting versions to decimal digit values 
                // for comparison.
                return this._decimalize(a) - this._decimalize(b);
            }).map((v) => v.map((n) => String(n)).join('_').concat('.sql'));
    };
    
    /**
     * Run a migration
     */
    _run_migration(m) {
        // Can't run a migration if db isn't initialized
        if (this.db === null) {
            this.logger.error(
                `Can't run migration until db has been initialized`
            );
            return;
        }

        try {
            // Apply m to db.
            const m_str = fs.readFileSync(
                join(__dirname, 'migrations', m),
                'utf8'
            );
    
            // parse the sql commands (removing comments) and build 
            // the transaction. Filter gets rid of ''.
            const sql_cmds = m_str
                .replace(/^--.*$/gm, "").split(';')
                .map((s) => s.trim()).filter((s) => !!s); 
    
            const run_mig = this.db.transaction(() => {
                for (const c of sql_cmds) this.db.prepare(c).run();
            });
    
            run_mig();
        } catch (error) {
            // Delete db file and hard error
            fs.unlinkSync(DB_PATH);
            throw new MigrationError(
                "Failed to initialize database with migration files",
                m.split('.')[0],
                error
            );
        }
    }; 

    run() {
        const db_preexistent = fs.existsSync(this.db_path);
        
        this.db = new Database(this.db_path);
        this.db.pragma('journal_mode = WAL'); // Recommended for performance
        
        const migrations = this._get_sorted_migrations();
        if (!db_preexistent) {
            this.logger.info(
                "tblg database doesn't exist. Initializing now..."
            );
        
            // Initialize from migrations
            for (const m of migrations) {
                this.logger.info(`applying v${m.split('.')[0]} changes`);
                this._run_migration(m);
            }
            this.logger.info(
                "Migrations successfully applied. Database initialized."
            );
        } else {
            this.logger.info(
                "tblg database already exists. Making sure it's up to date..."
            );
        
            // Check if migrated. If version correct, then nothing to apply. 
            const latest_version = migrations.slice(-1)[0].split('.')[0];
        
            // Assumes a versions table with columns major, minor, 
            // and patch exists
            const version_data = this.db.prepare(`
                SELECT major, minor, patch FROM versions 
                    ORDER BY id DESC LIMIT 1
            `).get();
        
            const db_version = [
                'major',
                'minor',
                'patch'
            ].map((k) => version_data[k]).join('_');

            const migrated = (db_version === latest_version);

            const db_number = this._decimalize(
                db_version.split('_').map((n) => +n)
            );

            const latest_number = this._decimalize(
                latest_version.split('_').map((n) => +n)
            );
        
            // If we're somehow running a newer database version, do nothing
            if (db_number > latest_number) {
                this.logger.info(
                    `tblg is (strangely) more than up-to-date: ` + 
                    `v${db_version} (newest migration: v${latest_version})`
                );

                return;
            }
        
            // Otherwise apply new migrations.
            if (!migrated) {
                this.logger.info(
                    `db is on v${db_version}, need to ` + 
                    `migrate to v${latest_version}`
                );
        
                let idx = migrations.indexOf(db_version.concat('.sql')) + 1;
                while (idx < migrations.length) {
                    this.logger.info(
                        `applying v${migrations[idx].split('.')[0]} migration`
                    );
                    this._run_migration(migrations[idx]);
                    idx++;
                }
            }
        
            this.logger.info(
                `tblg is up-to-date and using the newest db version: ` + 
                `v${latest_version}`
            );
        }
    }
}

const destroy_test_db = () => {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
};

const db_initializer = new DBInitializer(TEST_DB_PATH, MIGRATIONS_PATH);

describe("CommentInterface", async (t) => {
    // Setup
    let post_interface;
    let comment_interface;
    before(() => {
        db_initializer.run();
        comment_interface = new CommentInterface(
            db_initializer.db,
            "comments-interface"
        );
        post_interface = new PostInterface(
            db_initializer.db,
            "posts-interface"
        );

        // dummify the loggers
        comment_interface.logger = logger;
        post_interface.logger = logger;
    });

    let init_post_id;
    let init_comment_id;
    it("creates comments", async () => {
        const post_data = await post_interface.create_post({
            author: "Thomas Noel",
            title: "My Favorite",
            content: "<strong>I love Susannah!!!</strong>",
            md_path: "views/posts/test/test1.md",
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
