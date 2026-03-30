
/**
 * Comments are at least names and a text string, but can also include
 * an email address and a url. All comments are associated with a post.
 *
 */
class CommentInterface {
    #db;

    constructor(db) {
        this.#db = db;
    }

    // TODO
}

module.exports = { CommentInterface };
