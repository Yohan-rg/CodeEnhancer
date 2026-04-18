export interface LanguageSnippetMap {
  [language: string]: Record<string, string>;
}

export interface CodeEnhancerSettings {
  enableAutocomplete: boolean;
  enableAutoIndent: boolean;
  enableAutoCloseTags: boolean;
  enableSmartPairs: boolean;
  enableTabIndent: boolean;
  enableCommentToggle: boolean;
  enableSyntaxHighlight: boolean;
  enableSnippets: boolean;
  enableLint: boolean;
  indentSize: number;
  snippets: LanguageSnippetMap;
}

export const DEFAULT_SNIPPETS: LanguageSnippetMap = {
  javascript: {
    fn: "function ${name}(${args}) {\n\t${cursor}\n}",
    afn: "async function ${name}(${args}) {\n\t${cursor}\n}",
    if: "if (${condition}) {\n\t${cursor}\n}"
  },
  typescript: {
    fn: "function ${name}(${args}): ${type} {\n\t${cursor}\n}",
    cls: "class ${Name} {\n\tconstructor(${args}) {\n\t\t${cursor}\n\t}\n}",
    if: "if (${condition}) {\n\t${cursor}\n}"
  },
  python: {
    def: "def ${name}(${args}):\n\t${cursor}",
    cls: "class ${Name}:\n\tdef __init__(self, ${args}):\n\t\t${cursor}",
    imp: "import ${module}"
  },
  html: {
    div: "<div>\n\t${cursor}\n</div>",
    a: "<a href=\"${url}\">${text}</a>",
    img: "<img src=\"${src}\" alt=\"${alt}\" />"
  },
  css: {
    rule: "${selector} {\n\t${cursor}\n}",
    flex: "display: flex;\njustify-content: ${cursor};\nalign-items: center;"
  },
  json: {
    obj: "{\n\t\"${key}\": ${cursor}\n}",
    arr: "[\n\t${cursor}\n]"
  },
  bash: {
    if: "if [ ${condition} ]; then\n\t${cursor}\nfi",
    for: "for ${item} in ${items}; do\n\t${cursor}\ndone"
  }
};

export const DEFAULT_SETTINGS: CodeEnhancerSettings = {
  enableAutocomplete: true,
  enableAutoIndent: true,
  enableAutoCloseTags: true,
  enableSmartPairs: true,
  enableTabIndent: true,
  enableCommentToggle: true,
  enableSyntaxHighlight: true,
  enableSnippets: true,
  enableLint: true,
  indentSize: 2,
  snippets: DEFAULT_SNIPPETS
};
