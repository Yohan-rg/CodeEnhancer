# Code Enhancer for Obsidian

Code Enhancer is an Obsidian plugin that upgrades fenced code blocks with lightweight IDE behaviors using CodeMirror 6:

- Language-aware autocomplete (JavaScript/TypeScript, Python, HTML, CSS, JSON, Bash)
- Smart indentation and dedentation
- Auto-closing HTML/XML tags
- Smart bracket and quote pairing
- Tab and Shift+Tab block indentation
- Comment toggling (`Mod+/`)
- Configurable snippets
- Lightweight lint-like diagnostics (unclosed brackets/tags, indentation mismatches)

## Build

```bash
npm install
npm run check
npm run build
```

Copy the generated files to your vault plugin directory:

- `main.js`
- `manifest.json`
- `styles.css` (optional, not required here)

## Development

```bash
npm run dev
```
