const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
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
    let comment_interface;
    before(() => {
        const db = create_test_db();
        comment_interface = new CommentInterface(db, logger);
    });

    if("creates comments", () => {});

    // TODO

    after(() => {
        destroy_test_db();
    });
});
