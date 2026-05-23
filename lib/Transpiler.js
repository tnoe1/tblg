const { unified } = require("unified");
const remarkParse = require("remark-parse");
const remarkMath = require("remark-math");
const remarkGfm = require("remark-gfm");
const remarkRehype = require("remark-rehype");
const remarkStringify = require("remark-stringify");
const rehypeKatex = require("rehype-katex");
const rehypeParse = require("rehype-parse");
const rehypeRemark = require("rehype-remark");
const rehypeStringify = require("rehype-stringify");

const LoggedEntity = require("./LoggedEntity");

class Transpiler extends LoggedEntity {
    constructor() { super("transpiler") }

    async md_to_html(md) {
        let result = await unified()
            .use(remarkParse) // parse md to ast
            .use(remarkGfm)   // extends mdast parser for github flav. markdown
            .use(remarkMath)  // extends parser to understand math syntax
            .use(remarkRehype) // converts md ast to html ast
            .use(rehypeKatex)  // renders math nodes into html
            .use(rehypeStringify) // serializes into html string
            .process(md);

        return String(result);
    }

    async html_to_md(html) {
        let result = await unified()
            .use(rehypeParse)
            .use(rehypeRemark)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkStringify)
            .process(html)
            
        return String(result);
    }
}

module.exports = Transpiler;

