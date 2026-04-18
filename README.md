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

## Package (recommended)

This command creates a ready-to-copy plugin folder at `dist/code-enhancer`:

```bash
npm run package
```

Then copy `dist/code-enhancer` into your vault at:

`<Vault>/.obsidian/plugins/code-enhancer`

## Manual install

Only these runtime files are required in the vault plugin folder:

- `manifest.json`
- `main.js`
- `versions.json`

Do **not** copy `src/`, `node_modules/`, or TypeScript config files into the vault plugin directory.

## Troubleshooting: “Failed to load plugin”

1. Confirm the plugin folder name exactly matches the manifest ID:
   - folder: `code-enhancer`
   - `manifest.json` id: `code-enhancer`
2. Confirm the folder contains `manifest.json` and `main.js`.
3. Run `npm run build` again and recopy `main.js`.
4. Fully restart Obsidian after copying files.
5. Open Developer Console in Obsidian (`Ctrl/Cmd+Shift+I`) and check the exact error.

## Development

```bash
npm run dev
```
