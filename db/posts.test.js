const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const PostInterface = require("./posts");

const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

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


describe("PostInterface", async (t) => {
    // Setup
    let post_interface;
    before(() => {
        const db = create_test_db();
        post_interface = new PostInterface(db, logger);
    });

    // Tests here
    let init_post_id;
    it("creates posts", () => {
        const post_data = post_interface.create_post({
            author: "Thomas Noel",
            content: "I love Susannah!!!",
            categories: ["Love", "Family"]
        });

        assert.strictEqual(post_data.success, true);
        assert.strictEqual(post_data.data.content, "I love Susannah!!!");

        init_post_id = post_data.data.id;

        const alt_pd = post_interface.get_post_by_id(post_data.data.id);
        assert.strictEqual(alt_pd.data.content, "I love Susannah!!!");
    });

    let child_id;
    it("can associate post with a parent", () => {
        const next_post_data = post_interface.create_post({
            author: "Thomas Noel",
            content: "I love Ivan too!!!",
            parent_id: init_post_id,
            categories: ["Love", "Family"]
        });

        assert.strictEqual(next_post_data.success, true);
        assert.strictEqual(next_post_data.data.parent, init_post_id);

        child_id = next_post_data.data.id;

        const parent_data = post_interface.get_post_by_id(
            next_post_data.data.parent
        );

        assert.strictEqual(parent_data.data.content, "I love Susannah!!!");
    });

    it("can get parent associated with a post", () => {
        const parent_data = post_interface.get_parent_of(child_id);

        assert.strictEqual(parent_data.success, true);
        assert.strictEqual(parent_data.data.id, init_post_id)
        assert.strictEqual(parent_data.data.content, "I love Susannah!!!");

        // Also get parent data for post that doesn't have a parent and
        // test that the data is an empty object.
        const nonexistent_pd = post_interface.get_parent_of(init_post_id);

        assert.strictEqual(nonexistent_pd.success, false);
        assert.strictEqual(typeof nonexistent_pd.data, 'object');
        assert.strictEqual(Object.keys(nonexistent_pd.data).length, 0);
    });

    let aug_id;
    it("can get posts by author", () => {
        const aug_data = post_interface.create_post({
            author: "St. Augustine",
            content: "ordo amoris",
            categories: ["Love", "Theology"]
        });

        const noel_posts = post_interface.get_posts_by_author("Thomas Noel");
        assert.strictEqual(noel_posts.data.length, 2);
        noel_posts.data.forEach((p) => { 
            assert.strictEqual(p.author, "Thomas Noel");
        });

        const aug_posts = post_interface.get_posts_by_author("St. Augustine");
        assert.strictEqual(aug_posts.data.length, 1);
        aug_posts.data.forEach((p) => {
            assert.strictEqual(p.author, "St. Augustine");
        });

        aug_id = aug_data.data.id;
    });

    let init_ts;
    it("can get posts created after specified ts", async () => {
        // Make sure we generate a timestamp that is newer than that
        // associated with previous entries.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        init_ts = Math.floor(Date.now() / 1000);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));

        post_interface.create_post({
            author: "Ivan Noel",
            content: "big big excavator move the dirt",
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
        const aug_data = post_interface.create_post({
            author: "St. Augustine",
            content: "ordo amoris",
            categories: ["Love", "Theology"]
        });

        assert.strictEqual(aug_data.data.content, "ordo amoris");

        const original_last_updated_ts = aug_data.data.last_updated_unix_sec;

        await new Promise((resolve) => setTimeout(resolve, 1000));
        split_ts = Math.floor(Date.now() / 1000);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const updated_data = post_interface.update_post(
            aug_data.data.id,
            "ordered loves"
        );

        assert.strictEqual(updated_data.success, true);
        assert.strictEqual(updated_data.data.content, "ordered loves");

        const updated_ts = updated_data.data.last_updated_unix_sec;
        assert.notStrictEqual(original_last_updated_ts, updated_ts);

        aug_id = updated_data.data.id;
    });

    it("can get posts last updated after ts", async () => {
        const recently_updated = post_interface.get_posts_last_updated_after(split_ts);
        assert.strictEqual(recently_updated.success, true);
        assert.strictEqual(recently_updated.data.length, 1);
        assert.strictEqual(recently_updated.data[0].id, aug_id);
        assert.strictEqual(recently_updated.data[0].content, "ordered loves");
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

