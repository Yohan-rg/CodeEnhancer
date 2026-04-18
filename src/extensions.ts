import {
  autocompletion,
  CompletionContext,
  Completion,
  snippetCompletion,
  startCompletion
} from "@codemirror/autocomplete";
import { indentUnit, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { linter, Diagnostic } from "@codemirror/lint";
import { EditorSelection, Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { CodeEnhancerSettings } from "./types";
import {
  getCodeBlockContext,
  getIndentUnit,
  getLanguageLineComment,
  getLineIndent,
  getLineText,
  normalizeLanguage,
  parseLastOpenedHtmlTag,
  shouldDecreaseIndent,
  shouldIncreaseIndent
} from "./language-utils";
import { buildSnippetExpansion, extractWordBeforeCursor } from "./snippets";

const LANGUAGE_COMPLETIONS: Record<string, Completion[]> = {
  javascript: [
    snippetCompletion("function ${name}(${args}) {\n\t${}\n}", { label: "function", type: "keyword" }),
    snippetCompletion("if (${condition}) {\n\t${}\n} else {\n\t\n}", { label: "if/else", type: "keyword" }),
    snippetCompletion("async function ${name}(${args}) {\n\tawait ${}\n}", { label: "async", type: "keyword" }),
    snippetCompletion("try {\n\t${}\n} catch (${error}) {\n\t\n}", { label: "try/catch", type: "keyword" }),
    { label: "const", type: "keyword" },
    { label: "let", type: "keyword" }
  ],
  typescript: [
    { label: "interface", type: "keyword" },
    { label: "type", type: "keyword" },
    snippetCompletion("class ${Name} {\n\tconstructor(${args}) {\n\t\t${}\n\t}\n}", { label: "class", type: "keyword" })
  ],
  python: [
    snippetCompletion("def ${name}(${args}):\n\t${}", { label: "def", type: "keyword" }),
    snippetCompletion("class ${Name}:\n\tdef __init__(self, ${args}):\n\t\t${}", { label: "class", type: "keyword" }),
    snippetCompletion("for ${item} in ${iterable}:\n\t${}", { label: "for", type: "keyword" }),
    snippetCompletion("if ${condition}:\n\t${}", { label: "if", type: "keyword" }),
    { label: "import", type: "keyword" },
    { label: "from", type: "keyword" }
  ],
  html: [
    ...["div", "span", "section", "article", "header", "footer", "main", "nav", "button", "a", "input", "form", "img"].map(
      (tag) => ({ label: tag, type: "type" as const, apply: `<${tag}>` })
    ),
    ...["class", "id", "href", "src", "alt", "type", "name", "value", "data-"].map((attr) => ({
      label: attr,
      type: "property" as const,
      apply: `${attr}=""`
    }))
  ],
  css: [
    ...["display", "position", "margin", "padding", "color", "background", "font-size", "grid", "flex"].map((prop) => ({
      label: prop,
      type: "property" as const
    }))
  ],
  json: [{ label: '"key": "value"', type: "property" }, { label: "true", type: "keyword" }, { label: "false", type: "keyword" }],
  bash: [
    { label: "if", type: "keyword" },
    { label: "then", type: "keyword" },
    { label: "fi", type: "keyword" },
    snippetCompletion("for ${item} in ${items}; do\n\t${}\ndone", { label: "for", type: "keyword" })
  ]
};

function inCodeBlock(view: EditorView): ReturnType<typeof getCodeBlockContext> {
  return getCodeBlockContext(view.state, view.state.selection.main.head);
}

function codeAwareCompletion(settings: CodeEnhancerSettings) {
  return (context: CompletionContext) => {
    if (!settings.enableAutocomplete) return null;

    const block = getCodeBlockContext(context.state, context.pos);
    if (!block) return null;

    const word = context.matchBefore(/[A-Za-z_][\w-]*/);
    if (!word && !context.explicit) return null;

    const lang = normalizeLanguage(block.language);
    const builtIn = LANGUAGE_COMPLETIONS[lang] ?? [];

    const snippetEntries = settings.enableSnippets
      ? Object.entries(settings.snippets[lang] ?? {}).map(([trigger, template]) =>
          snippetCompletion(template.replace("${cursor}", "${}"), {
            label: trigger,
            type: "snippet",
            info: `Snippet (${lang})`
          })
        )
      : [];

    return {
      from: word?.from ?? context.pos,
      options: [...snippetEntries, ...builtIn]
    };
  };
}

function enterIndentCommand(settings: CodeEnhancerSettings) {
  return (view: EditorView): boolean => {
    if (!settings.enableAutoIndent) return false;
    const block = inCodeBlock(view);
    if (!block) return false;

    const { state } = view;
    const cursor = state.selection.main;
    if (!cursor.empty) return false;

    const line = state.doc.lineAt(cursor.head);
    const before = line.text.slice(0, cursor.head - line.from);
    const after = line.text.slice(cursor.head - line.from);
    const baseIndent = getLineIndent(line.text);
    const unit = getIndentUnit(settings.indentSize);

    let indent = baseIndent;
    if (shouldIncreaseIndent(block.language, before)) {
      indent += unit;
    }
    if (shouldDecreaseIndent(block.language, after)) {
      indent = indent.endsWith(unit) ? indent.slice(0, -unit.length) : "";
    }

    const insert = `\n${indent}`;
    view.dispatch({
      changes: { from: cursor.head, to: cursor.head, insert },
      selection: EditorSelection.cursor(cursor.head + insert.length),
      userEvent: "input"
    });
    return true;
  };
}

function smartPairInputHandler(settings: CodeEnhancerSettings): Extension {
  const PAIRS: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'"
  };
  const CLOSERS = new Set(Object.values(PAIRS));

  return EditorView.inputHandler.of((view, from, to, text, insert) => {
    const block = getCodeBlockContext(view.state, from);
    if (!block) return false;

    if (settings.enableSmartPairs && text.length === 1) {
      const close = PAIRS[text];
      if (close) {
        const nextChar = view.state.doc.sliceString(from, from + 1);
        if (nextChar === close) {
          view.dispatch({
            selection: EditorSelection.cursor(from + 1),
            userEvent: "input.skip"
          });
          return true;
        }

        insert();
        view.dispatch({
          changes: { from: from + 1, to: from + 1, insert: close },
          selection: EditorSelection.cursor(from + 1),
          userEvent: "input.complete"
        });
        return true;
      }

      if (CLOSERS.has(text)) {
        const nextChar = view.state.doc.sliceString(from, from + 1);
        if (nextChar === text) {
          view.dispatch({ selection: EditorSelection.cursor(from + 1), userEvent: "input.skip" });
          return true;
        }
      }
    }

    if (settings.enableAutoCloseTags && text === ">") {
      insert();
      const pos = from + 1;
      const uptoCursor = view.state.doc.sliceString(block.from, pos);
      const tag = parseLastOpenedHtmlTag(uptoCursor);
      if (tag && ["html", "xml"].includes(normalizeLanguage(block.language))) {
        const nextSlice = view.state.doc.sliceString(pos, Math.min(block.to, pos + tag.length + 3));
        const expected = `</${tag}>`;
        if (!nextSlice.startsWith(expected)) {
          view.dispatch({
            changes: { from: pos, to: pos, insert: expected },
            selection: EditorSelection.cursor(pos),
            userEvent: "input.complete"
          });
          return true;
        }
      }
      return true;
    }

    return false;
  });
}

function indentSelection(view: EditorView, indent: boolean, size: number): boolean {
  const block = inCodeBlock(view);
  if (!block) return false;

  const unit = getIndentUnit(size);
  const ranges = view.state.selection.ranges;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of ranges) {
    const fromLine = view.state.doc.lineAt(range.from).number;
    const toLine = view.state.doc.lineAt(range.to).number;

    for (let lineNo = fromLine; lineNo <= toLine; lineNo++) {
      const line = view.state.doc.line(lineNo);
      if (line.from < block.from || line.to > block.to) continue;

      if (indent) {
        changes.push({ from: line.from, to: line.from, insert: unit });
      } else {
        const text = line.text;
        const removable = text.startsWith(unit)
          ? unit.length
          : text.startsWith("\t")
          ? 1
          : Math.min(unit.length, (text.match(/^ +/)?.[0].length ?? 0));
        if (removable > 0) {
          changes.push({ from: line.from, to: line.from + removable, insert: "" });
        }
      }
    }
  }

  if (!changes.length) return false;

  view.dispatch({
    changes,
    userEvent: indent ? "input.indent" : "delete.outdent"
  });
  return true;
}

function maybeExpandSnippet(view: EditorView, settings: CodeEnhancerSettings): boolean {
  if (!settings.enableSnippets) return false;

  const block = inCodeBlock(view);
  if (!block) return false;

  const pos = view.state.selection.main.head;
  const { word, from, to } = extractWordBeforeCursor(view.state, pos);
  if (!word) return false;

  const expansion = buildSnippetExpansion(settings.snippets, block.language, word, from, to);
  if (!expansion) return false;

  const cursor = expansion.from + expansion.cursorOffset;
  view.dispatch({
    changes: { from: expansion.from, to: expansion.to, insert: expansion.replacement },
    selection: EditorSelection.cursor(cursor),
    userEvent: "input.snippet"
  });
  return true;
}

function toggleLineComment(view: EditorView): boolean {
  const block = inCodeBlock(view);
  if (!block) return false;

  const marker = getLanguageLineComment(block.language);
  const htmlComment = normalizeLanguage(block.language) === "html";

  const ranges = view.state.selection.ranges;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of ranges) {
    const fromLine = view.state.doc.lineAt(range.from).number;
    const toLine = view.state.doc.lineAt(range.to).number;

    if (htmlComment) {
      const start = view.state.doc.line(fromLine).from;
      const end = view.state.doc.line(toLine).to;
      const selected = view.state.doc.sliceString(start, end);
      if (selected.trimStart().startsWith("<!--") && selected.trimEnd().endsWith("-->")) {
        const openIdx = selected.indexOf("<!--");
        const closeIdx = selected.lastIndexOf("-->");
        changes.push({ from: start + openIdx, to: start + openIdx + 4, insert: "" });
        changes.push({ from: start + closeIdx, to: start + closeIdx + 3, insert: "" });
      } else {
        changes.push({ from: start, to: start, insert: "<!--\n" });
        changes.push({ from: end, to: end, insert: "\n-->" });
      }
      continue;
    }

    if (!marker) continue;

    const allCommented = Array.from({ length: toLine - fromLine + 1 }).every((_, idx) => {
      const line = getLineText(view.state.doc, fromLine + idx);
      return line.trim().startsWith(marker);
    });

    for (let lineNo = fromLine; lineNo <= toLine; lineNo++) {
      const line = view.state.doc.line(lineNo);
      const indent = getLineIndent(line.text);

      if (allCommented) {
        const markerPos = line.text.indexOf(marker, indent.length);
        if (markerPos !== -1) {
          const from = line.from + markerPos;
          const to = from + marker.length + (line.text[from - line.from + marker.length] === " " ? 1 : 0);
          changes.push({ from, to, insert: "" });
        }
      } else {
        changes.push({ from: line.from + indent.length, to: line.from + indent.length, insert: `${marker} ` });
      }
    }
  }

  if (!changes.length) return false;
  view.dispatch({ changes, userEvent: "input.comment" });
  return true;
}

function basicDiagnostics(settings: CodeEnhancerSettings) {
  return linter((view) => {
    if (!settings.enableLint) return [];

    const diagnostics: Diagnostic[] = [];
    const state = view.state;

    for (const range of state.selection.ranges) {
      const block = getCodeBlockContext(state, range.head);
      if (!block) continue;

      const text = state.doc.sliceString(block.from, block.to);
      const stack: { char: string; pos: number }[] = [];
      const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
      const closeToOpen: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (pairs[ch]) stack.push({ char: ch, pos: block.from + i });
        if (closeToOpen[ch]) {
          const top = stack[stack.length - 1];
          if (!top || top.char !== closeToOpen[ch]) {
            diagnostics.push({
              from: block.from + i,
              to: block.from + i + 1,
              severity: "warning",
              message: "Unmatched closing bracket"
            });
          } else {
            stack.pop();
          }
        }
      }

      for (const unclosed of stack) {
        diagnostics.push({
          from: unclosed.pos,
          to: unclosed.pos + 1,
          severity: "warning",
          message: "Unclosed bracket"
        });
      }

      if (normalizeLanguage(block.language) === "html") {
        const openTags = [...text.matchAll(/<([a-zA-Z][\w-]*)(\s[^<>]*)?>/g)].map((m) => ({ tag: m[1].toLowerCase(), idx: m.index ?? 0 }));
        const closeTags = [...text.matchAll(/<\/(\w[\w-]*)>/g)].map((m) => ({ tag: m[1].toLowerCase(), idx: m.index ?? 0 }));
        const localStack: { tag: string; idx: number }[] = [];

        for (const tag of openTags) {
          if (tag.tag.endsWith("/") || ["img", "br", "input", "meta", "link", "hr"].includes(tag.tag)) continue;
          localStack.push(tag);
        }

        for (const tag of closeTags) {
          const idx = localStack.map((t) => t.tag).lastIndexOf(tag.tag);
          if (idx === -1) {
            diagnostics.push({
              from: block.from + tag.idx,
              to: block.from + tag.idx + tag.tag.length + 3,
              severity: "warning",
              message: `Closing tag </${tag.tag}> has no matching opening tag`
            });
          } else {
            localStack.splice(idx, 1);
          }
        }

        for (const dangling of localStack) {
          diagnostics.push({
            from: block.from + dangling.idx,
            to: block.from + dangling.idx + dangling.tag.length + 2,
            severity: "warning",
            message: `Tag <${dangling.tag}> is not closed`
          });
        }
      }

      const startLine = state.doc.lineAt(block.from).number;
      const endLine = state.doc.lineAt(block.to).number;
      const unit = settings.indentSize;
      for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
        const line = state.doc.line(lineNo);
        const indentLen = getLineIndent(line.text).replace(/\t/g, " ".repeat(unit)).length;
        if (indentLen % unit !== 0) {
          diagnostics.push({
            from: line.from,
            to: line.from + Math.min(line.text.length, indentLen),
            severity: "info",
            message: `Indentation is not aligned to ${unit}-space steps`
          });
        }
      }
    }

    return diagnostics;
  });
}

function enhancementHighlighting(): Extension {
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--text-accent)" },
      { tag: tags.string, color: "var(--color-green)" },
      { tag: tags.number, color: "var(--color-orange)" },
      { tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
      { tag: tags.function(tags.variableName), color: "var(--color-cyan)" },
      { tag: tags.bracket, color: "var(--color-purple)" }
    ])
  );
}

export function createCodeEnhancerExtensions(settings: CodeEnhancerSettings): Extension[] {
  const extensions: Extension[] = [
    indentUnit.of(getIndentUnit(settings.indentSize)),
    smartPairInputHandler(settings),
    autocompletion({
      activateOnTyping: true,
      override: [codeAwareCompletion(settings)],
      maxRenderedOptions: 30,
      closeOnBlur: true
    }),
    keymap.of([
      {
        key: "Enter",
        run: enterIndentCommand(settings)
      },
      {
        key: "Tab",
        run: (view) => {
          if (settings.enableTabIndent) {
            if (maybeExpandSnippet(view, settings)) return true;
            if (view.state.selection.main.empty) {
              const block = inCodeBlock(view);
              if (block) {
                view.dispatch(view.state.replaceSelection(getIndentUnit(settings.indentSize)));
                return true;
              }
            }
            if (indentSelection(view, true, settings.indentSize)) return true;
          }

          const block = inCodeBlock(view);
          if (block && settings.enableAutocomplete) {
            return startCompletion(view);
          }

          return false;
        }
      },
      {
        key: "Shift-Tab",
        run: (view) => (settings.enableTabIndent ? indentSelection(view, false, settings.indentSize) : false)
      },
      {
        key: "Mod-/",
        run: (view) => (settings.enableCommentToggle ? toggleLineComment(view) : false)
      }
    ]),
    basicDiagnostics(settings)
  ];

  if (settings.enableSyntaxHighlight) {
    extensions.push(enhancementHighlighting());
  }

  return extensions;
}
