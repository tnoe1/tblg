const Database = require('better-sqlite3');
const fs = require("node:fs");
const { join } = require("node:path");

const CommentInterface = require("./comments");
const LoggedEntity = require("../lib/LoggedEntity");
const PostInterface = require("./posts");

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

class DBInitializer extends LoggedEntity {
    constructor(db_path, mig_path) {
        super("tblgdb");
        this.db_path = db_path;
        this.mig_path = mig_path;

        this.db = null;
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

// Initialize the db
const db_initializer = new DBInitializer(DB_PATH, MIGRATIONS_PATH);
(() => db_initializer.run())();

module.exports = {
    posts: new PostInterface(db_initializer.db, "posts-interface"),
    comments: new CommentInterface(db_initializer.db, "comments-interface")
};

