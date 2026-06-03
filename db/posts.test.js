const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

const LoggedEntity = require("../lib/LoggedEntity");
const PostInterface = require("./posts");


// This should be deleted after tests are run
const TEST_DB_DIR = join(__dirname, 'data/posts_test');
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

describe("PostInterface", async (t) => {
    // Setup
    let post_interface;
    before(() => {
        db_initializer.run();
        post_interface = new PostInterface(db_initializer.db, "posts-interface");

        // dummify the logger
        post_interface.logger = logger;
    });

    // Tests here
    let init_post_id;
    it("creates posts", async () => {
        const post_data = await post_interface.create_post({
            author: "Thomas Noel",
            title: "My Favorite",
            content: "<strong>I love Susannah!!!</strong>",
            md_path: "views/posts/test/test1.md",
            categories: ["Love", "Family"]
        });

        assert.strictEqual(post_data.success, true);
        assert.strictEqual(post_data.data.content, "<strong>I love Susannah!!!</strong>")
        init_post_id = post_data.data.id;

        const alt_pd = post_interface.get_post_by_id(post_data.data.id);
        assert.strictEqual(alt_pd.data.content, "<strong>I love Susannah!!!</strong>");
    });

    let child_id;
    it("can associate post with a parent", async () => {
        const next_post_data = await post_interface.create_post({
            author: "Thomas Noel",
            title: "My Other Favorite",
            content: "<em>I love Ivan too!!!</em>",
            md_path: "views/posts/test/test2.md",
            parent_id: init_post_id,
            categories: ["Love", "Family"]
        });

        assert.strictEqual(next_post_data.success, true);
        assert.strictEqual(next_post_data.data.parent, init_post_id);

        child_id = next_post_data.data.id;

        const parent_data = post_interface.get_post_by_id(
            next_post_data.data.parent
        );

        assert.strictEqual(parent_data.data.content, "<strong>I love Susannah!!!</strong>");
    });

    it("can get parent associated with a post", () => {
        const parent_data = post_interface.get_parent_of(child_id);

        assert.strictEqual(parent_data.success, true);
        assert.strictEqual(parent_data.data.id, init_post_id)
        assert.strictEqual(parent_data.data.content, "<strong>I love Susannah!!!</strong>");

        // Also get parent data for post that doesn't have a parent and
        // test that the data is an empty object.
        const nonexistent_pd = post_interface.get_parent_of(init_post_id);

        assert.strictEqual(nonexistent_pd.success, false);
        assert.strictEqual(typeof nonexistent_pd.data, 'object');
        assert.strictEqual(Object.keys(nonexistent_pd.data).length, 0);
    });

    let aug_id;
    it("can get posts by author", async () => {
        const aug_data = await post_interface.create_post({
            author: "St. Augustine",
            title: "In Latin",
            content: "<em>ordo</em> amoris",
            md_path: "views/posts/test/test3.md",
            categories: ["Love", "Theology"]
        });

        const noel_posts = post_interface.get_posts_by_author("Thomas Noel");
        assert.strictEqual(noel_posts.data.length, 2);
        noel_posts.data.forEach((p) => { 
            assert.strictEqual(p.author, "Thomas Noel");
        });

        const aug_posts = post_interface.get_posts_by_author("St. Augustine");
        assert.strictEqual(aug_posts.data.length, 1);
        assert.strictEqual(aug_posts.data[0].title, "In Latin");
        aug_posts.data.forEach((p) => {
            assert.strictEqual(p.author, "St. Augustine");
        });

        aug_id = aug_data.data.id;
    });

    it("can get post ids", () => {
        const post_ids = post_interface.get_post_ids();

        assert.strictEqual(post_ids.data.length, 3);
        assert.strictEqual(post_ids.data.includes(1), true);
        assert.strictEqual(post_ids.data.includes(2), true);
        assert.strictEqual(post_ids.data.includes(3), true);
    });

    let init_ts;
    it("can get posts created after specified ts", async () => {
        // Make sure we generate a timestamp that is newer than that
        // associated with previous entries.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        init_ts = Math.floor(Date.now() / 1000);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await post_interface.create_post({
            author: "Ivan Noel",
            title: "Excavators",
            content: "<strong>big big excavator move the dirt</strong>",
            md_path: "views/posts/test/test4.md",
            categories: ["Construction", "Love"]
        });

        const fresh_posts = post_interface.get_posts_created_after(init_ts);
        assert.strictEqual(fresh_posts.data.length, 1);
        assert.strictEqual(fresh_posts.data[0].author, "Ivan Noel");
    });

    it("can get posts created before specified ts", () => {
        const old_posts = post_interface.get_posts_created_before(init_ts);
        assert.strictEqual(old_posts.data.length, 3);
    });

    it("can delete a post with a specified id", () => {
        const orig_post = post_interface.get_post_by_id(aug_id);
        assert.strictEqual(orig_post.success, true);
        assert.strictEqual(orig_post.data.id, aug_id);

        const info = post_interface.delete_post(aug_id);
        assert.strictEqual(info.success, true);

        const deleted_post = post_interface.get_post_by_id(aug_id);
        assert.strictEqual(deleted_post.success, false);
        assert.strictEqual(typeof deleted_post.data, 'object');
        assert.strictEqual(Object.keys(deleted_post.data).length, 0);

        // delete post that doesn't exist
        const fake_info = post_interface.delete_post(100);
        assert.strictEqual(fake_info.success, false);
    });

    let split_ts;
    it("can update existing posts", async () => {
        const aug_data = await post_interface.create_post({
            author: "St. Augustine",
            title: "In Latin", 
            content: "<em>ordo</em> amoris",
            md_path: "views/posts/test/test3.md",
            categories: ["Love", "Theology"]
        });

        assert.strictEqual(aug_data.data.content, "<em>ordo</em> amoris");

        const original_last_updated_ts = aug_data.data.last_updated_unix_sec;

        await new Promise((resolve) => setTimeout(resolve, 1000));
        split_ts = Math.floor(Date.now() / 1000);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const updated_data = await post_interface.update_post(
            aug_data.data.id,
            "views/posts/test/test5.md",
            {
                updated_content: "<em>ordered</em> loves",
                updated_title: "In English"
            }
        );

        assert.strictEqual(updated_data.success, true);
        assert.strictEqual(updated_data.data.content, "<em>ordered</em> loves");
        assert.strictEqual(updated_data.data.title, "In English");
        assert.strictEqual(updated_data.data.author, "St. Augustine");

        const updated_ts = updated_data.data.last_updated_unix_sec;
        assert.notStrictEqual(original_last_updated_ts, updated_ts);

        aug_id = updated_data.data.id;
    });

    it("can get posts last updated after ts", async () => {
        const recently_updated = post_interface.get_posts_last_updated_after(split_ts);
        assert.strictEqual(recently_updated.success, true);
        assert.strictEqual(recently_updated.data.length, 1);
        assert.strictEqual(recently_updated.data[0].id, aug_id);
        assert.strictEqual(recently_updated.data[0].content, "<em>ordered</em> loves");
    });

    it("can get posts last updated before ts", () => {
        const past_updated = post_interface.get_posts_last_updated_before(split_ts);
        assert.strictEqual(past_updated.success, true);
        assert.strictEqual(past_updated.data.length, 3);
    });

    it("can get posts associated with specified category", () => {
        const love_posts = post_interface.get_posts_of_category("Love");
        const norm_love_posts = post_interface.get_posts_of_category("love");
        assert.strictEqual(love_posts.data.length, 4);
        assert.strictEqual(love_posts.data.length, norm_love_posts.data.length);
        assert.deepStrictEqual(love_posts.data, norm_love_posts.data);

        const construction_posts = post_interface.get_posts_of_category("Construction");
        assert.strictEqual(construction_posts.data.length, 1);
        assert.strictEqual(construction_posts.data[0].author, "Ivan Noel");

        const coffee_posts = post_interface.get_posts_of_category("Coffee");
        assert.strictEqual(coffee_posts.data.length, 0);
    });

    // Teardown
    after(() => {
        destroy_test_db();
    });
});

