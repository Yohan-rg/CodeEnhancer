import { EditorState, Text } from "@codemirror/state";

export interface CodeBlockContext {
  from: number;
  to: number;
  language: string;
  openFenceLine: number;
  closeFenceLine: number;
}

const OPEN_FENCE = /^```\s*([\w#+-]+)/;
const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  xml: "html"
};

export function normalizeLanguage(language: string): string {
  const lower = language.trim().toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

export function getCodeBlockContext(state: EditorState, pos: number): CodeBlockContext | null {
  const doc = state.doc;
  const lineAtPos = doc.lineAt(pos);

  let openingLineNo = -1;
  let openingLanguage = "";

  for (let lineNo = lineAtPos.number; lineNo >= 1; lineNo--) {
    const lineText = doc.line(lineNo).text.trim();
    if (lineText.startsWith("```")) {
      const match = lineText.match(OPEN_FENCE);
      if (match) {
        openingLineNo = lineNo;
        openingLanguage = normalizeLanguage(match[1] ?? "");
      }
      break;
    }
  }

  if (openingLineNo === -1 || !openingLanguage) {
    return null;
  }

  let closingLineNo = -1;
  for (let lineNo = openingLineNo + 1; lineNo <= doc.lines; lineNo++) {
    const lineText = doc.line(lineNo).text.trim();
    if (lineText.startsWith("```")) {
      closingLineNo = lineNo;
      break;
    }
  }

  if (closingLineNo === -1) {
    return null;
  }

  const contentFrom = doc.line(openingLineNo).to + 1;
  const contentTo = doc.line(closingLineNo).from - 1;

  if (pos < contentFrom || pos > contentTo) {
    return null;
  }

  return {
    from: contentFrom,
    to: contentTo,
    language: openingLanguage,
    openFenceLine: openingLineNo,
    closeFenceLine: closingLineNo
  };
}

export function getLanguageLineComment(language: string): string | null {
  switch (normalizeLanguage(language)) {
    case "javascript":
    case "typescript":
    case "css":
    case "json":
      return "//";
    case "python":
    case "bash":
      return "#";
    default:
      return null;
  }
}

export function getLineIndent(line: string): string {
  const match = line.match(/^\s*/);
  return match?.[0] ?? "";
}

export function getIndentUnit(size: number): string {
  return " ".repeat(Math.max(1, size));
}

export function shouldIncreaseIndent(language: string, lineBeforeCursor: string): boolean {
  const trimmed = lineBeforeCursor.trim();
  const lang = normalizeLanguage(language);

  if (["javascript", "typescript", "css", "json"].includes(lang)) {
    return /[\[{(]\s*$/.test(trimmed) || /\b(else|try|finally)\s*$/.test(trimmed);
  }

  if (lang === "python") {
    return /:\s*$/.test(trimmed);
  }

  if (lang === "html") {
    const openTag = trimmed.match(/<([a-zA-Z][\w-]*)(\s[^>]*)?>$/);
    if (!openTag) return false;
    const tag = openTag[1].toLowerCase();
    return !VOID_HTML_TAGS.has(tag) && !trimmed.endsWith("/>");
  }

  if (lang === "bash") {
    return /\b(then|do|case)\s*$/.test(trimmed);
  }

  return false;
}

export function shouldDecreaseIndent(language: string, lineAfterCursor: string): boolean {
  const trimmed = lineAfterCursor.trim();
  const lang = normalizeLanguage(language);

  if (["javascript", "typescript", "css", "json"].includes(lang)) {
    return /^[\]}\)]/.test(trimmed);
  }

  if (lang === "python") {
    return /^(elif|else|except|finally)\b/.test(trimmed);
  }

  if (lang === "html") {
    return /^<\//.test(trimmed);
  }

  if (lang === "bash") {
    return /^(fi|done|esac)\b/.test(trimmed);
  }

  return false;
}

export function parseLastOpenedHtmlTag(text: string): string | null {
  const openTagRegex = /<([a-zA-Z][\w-]*)(\s[^<>]*)?>/g;
  const closeTagRegex = /<\/(\w[\w-]*)>/g;

  const stack: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = openTagRegex.exec(text))) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    if (full.endsWith("/>") || VOID_HTML_TAGS.has(tag)) continue;
    stack.push(tag);
  }

  while ((m = closeTagRegex.exec(text))) {
    const tag = m[1].toLowerCase();
    const idx = stack.lastIndexOf(tag);
    if (idx !== -1) {
      stack.splice(idx, 1);
    }
  }

  return stack.length ? stack[stack.length - 1] : null;
}

export function getLineText(doc: Text, lineNo: number): string {
  if (lineNo < 1 || lineNo > doc.lines) return "";
  return doc.line(lineNo).text;
}
