import { EditorState } from "@codemirror/state";
import { normalizeLanguage } from "./language-utils";
import type { LanguageSnippetMap } from "./types";

export interface SnippetExpansion {
  replacement: string;
  cursorOffset: number;
  from: number;
  to: number;
}

export function extractWordBeforeCursor(state: EditorState, pos: number): { word: string; from: number; to: number } {
  const line = state.doc.lineAt(pos);
  const localPos = pos - line.from;
  const before = line.text.slice(0, localPos);
  const match = before.match(/[A-Za-z_][\w-]*$/);
  if (!match || match.index === undefined) {
    return { word: "", from: pos, to: pos };
  }

  const from = line.from + match.index;
  return { word: match[0], from, to: pos };
}

export function buildSnippetExpansion(
  snippets: LanguageSnippetMap,
  language: string,
  trigger: string,
  from: number,
  to: number
): SnippetExpansion | null {
  const lang = normalizeLanguage(language);
  const byLang = snippets[lang] ?? {};
  const template = byLang[trigger];

  if (!template) {
    return null;
  }

  const cursorToken = "${cursor}";
  const tokenIndex = template.indexOf(cursorToken);
  const replacement = template.replace(cursorToken, "");

  return {
    replacement,
    cursorOffset: tokenIndex === -1 ? replacement.length : tokenIndex,
    from,
    to
  };
}
