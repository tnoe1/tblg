const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");

const LoggedEntity = require("../lib/LoggedEntity");
const PostSyncer = require("./PostSyncer");

class ServiceInterface extends LoggedEntity {
    #db_interface;
    #post_syncer;

    constructor(db_interface) {
        super("service-interface");
        this.#db_interface = db_interface;
        this.#post_syncer = new PostSyncer(db_interface);
    }

    async _file_exists(path) {
        let file_exists;
        try {
            await fs.access(path, constants.F_OK);
            file_exists = true;
        } catch (err) {
            file_exists = false;
        }

        return file_exists;
    }

    async load_home() {
        const home_path = path.join(__dirname, "../views/index.html");

        let home_page = null;
        try {
            home_page = await fs.readFile(home_path, { encoding: 'utf8' });
        } catch (err) {
            this.logger.error(`Failed to load home page: ${err}`);
        }

        return home_page;
    }

    async load_post(post_id) {
        const template_path = path.join(
            __dirname,
            "../views/rendering/post_template.html"
        );

        let post_html = null;
        try {
            let post = await this.#db_interface.posts.get_post_by_id(post_id);
            post_html = post.data.content;
        } catch (err) {
            this.logger.error(`Failed to load post ${post_id}: ${err}`);
        }

        let template_html = await fs.readFile(
            template_path,
            { encoding: 'utf8' }
        );
        let wrapped_post_html = template_html.replace('{{POST_HTML}}', post_html);

        return wrapped_post_html;
    }

    async load_asset(asset_path) {
        let asset = null;
        try {
            asset = await fs.readFile(asset_path);
        } catch (err) {
            this.logger.error(`Failed to load asset: ${err}`);
        }

        return asset;
    }

    /**
     * Synchronize posts currently in database with the posts present in 
     * views/posts.
     */
    async synchronize_posts() {
        await this.#post_syncer.synchronize_posts();
    }
}

module.exports = ServiceInterface;
