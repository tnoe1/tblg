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
        // Recover original LaTex from annotation tag, create a placeholder in
        // the html (for safe passage through md conversion) and save it for 
        // postprocessing.
        const mathBlocks = [];
        const preprocessed = html
            .replace(
                /<div class="math math-display">.*?<annotation encoding="application\/x-tex">(.*?)<\/annotation>.*?<\/div>/gs,
                (_, tex) => { mathBlocks.push(`$$\n${tex}\n$$`); return `MATHBLOCK${mathBlocks.length - 1}`; }
            )
            .replace(
                /<span class="math math-inline">.*?<annotation encoding="application\/x-tex">(.*?)<\/annotation>.*?<\/span>/gs,
                (_, tex) => { mathBlocks.push(`$${tex}$`); return `MATHBLOCK${mathBlocks.length - 1}`; }
            );

        let result = await unified()
            .use(rehypeParse)
            .use(rehypeRemark)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkStringify)
            .process(preprocessed)
            
        return String(result).replace(
            /MATHBLOCK(\d+)/g,
            (_, i) => mathBlocks[i]
        );
    }
}

module.exports = Transpiler;

