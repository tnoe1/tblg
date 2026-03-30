
/**
 * Posts are html strings (MathML for math rendering), a date, an author,
 * and one or more categories. 
 * Any logic related to posts gets encapsulated here.
 *
 */
class PostInterface {
    #db;

    constructor(db) {
        this.#db = db;
    }

    // TODO
}

module.exports = { PostInterface };
