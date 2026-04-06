const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");
const PostInterface = require("./posts");
const CommentInterface = require("./comments");

const DB_PATH = join(__dirname, 'data/tblg.db');
const MIGRATIONS_PATH = join(__dirname, 'migrations');

class MigrationError extends Error {
    constructor(message, version, db_error) {
        super(message);
        this.name = "MigrationError";
        this.version = version;
        this.cause = db_error;
    }
}

/**
 * Logging wrapper for db.
 */
const logger = {
    info: (s) => {
        console.log('\x1b[38;5;46m[tblgdb] \x1b[0m\x1b[38;5;51m%s\x1b[0m', s);
    },
    warn: (s) => {
        console.log('\x1b[38;5;46m[tblgdb] \x1b[0m\x1b[0;49;93m%s\x1b[0m', s);
    },
    error: (s) => {
        console.log('\x1b[38;5;46m[tblgdb] \x1b[0m\x1b[0;49;91m%s\x1b[0m', s);
    }
};

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
        fs.unlinkSync(DB_PATH);
        throw new MigrationError(
            "Failed to initialize database with migration files",
            m.split('.')[0],
            error
        );
    }
}; 

const db_preexistent = fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Recommended for performance

const migrations = get_sorted_migrations();
if (!db_preexistent) {
    logger.info("tblg database doesn't exist. Initializing now...");

    // Initialize from migrations
    for (const m of migrations) {
        logger.info(`applying v${m.split('.')[0]} changes`);
        run_migration(db, m);
    }
    logger.info("Migrations successfully applied. Database initialized.");
} else {
    logger.info("tblg database already exists. Making sure it's up to date...");

    // Check if migrated. If version correct, then nothing to apply. 
    const latest_version = migrations.slice(-1)[0].split('.')[0];

    // Assumes a versions table with columns major, minor, and patch exists
    const version_data = db.prepare(
        'SELECT major, minor, patch FROM versions ORDER BY id DESC LIMIT 1'
    ).get();

    const db_version = [
        'major',
        'minor',
        'patch'
    ].map((k) => version_data[k]).join('_');

    const migrated = (db_version === latest_version);

    // Otherwise apply new migrations.
    if (!migrated) {
        logger.info(`db is on v${db_version}, need to migrate to v${latest_version}`);

        let idx = migrations.indexOf(db_version.concat('.sql')) + 1;
        while (idx < migrations.length) {
            logger.info(`applying v${migrations[idx].split('.')[0]} migration`);
            run_migration(db, migrations[idx]);
            idx++;
        }
    }

    logger.info(`tblg is up-to-date and using the newest db version: v${latest_version}`);
}

module.exports = {
    posts: new PostInterface(db, logger),
    comments: new CommentInterface(db, logger)
};

