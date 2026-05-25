const { unified } = require("unified");
const remarkParse = require("remark-parse").default;
const remarkMath = require("remark-math").default;
const remarkGfm = require("remark-gfm").default;
const remarkRehype = require("remark-rehype").default;
const remarkStringify = require("remark-stringify").default;
const rehypeKatex = require("rehype-katex").default;
const rehypeParse = require("rehype-parse").default;
const rehypeRemark = require("rehype-remark").default;
const rehypeStringify = require("rehype-stringify").default;

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

