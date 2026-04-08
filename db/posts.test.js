const test = require("node:test");
const assert = require("node:assert");
const PostInterface = require("./posts");

const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

// This should be deleted after tests are run
const TEST_DB_PATH = join(__dirname, 'data/tblg_test.db');
const MIGRATIONS_PATH = join(__dirname, 'migrations');

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
            fs.unlinkSync(TEST_DB_PATH);
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
    fs.unlinkSync(TEST_DB_PATH);
};


// Setup
const db = create_test_db();
const post_interface = new PostInterface(db, logger);

test("post creation works", () => {
    const post_data = post_interface.create_post({
        author: "Thomas Noel",
        content: "I love Susannah!!!",
        categories: ["Love", "Family"]
    });

    assert.strictEqual(post_data.success, true);
    assert.strictEqual(post_data.data.content, "I love Susannah!!!");

    const alt_pd = post_interface.get_post_by_id(post_data.data.id);
    assert.strictEqual(alt_pd.data.content, "I love Susannah!!!");
});

// test("parent post association works", () => {});

// Teardown
destroy_test_db();

