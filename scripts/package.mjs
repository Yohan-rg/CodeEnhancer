import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "manifest.json");
const mainJsPath = path.join(root, "main.js");
const versionsPath = path.join(root, "versions.json");
const outDir = path.join(root, "dist", "code-enhancer");

function ensureExists(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required file missing: ${file}. Run npm run build first.`);
  }
}

ensureExists(manifestPath);
ensureExists(mainJsPath);
ensureExists(versionsPath);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of [manifestPath, mainJsPath, versionsPath]) {
  fs.copyFileSync(file, path.join(outDir, path.basename(file)));
}

const readme = `Code Enhancer packaged plugin output.\n\nCopy this folder to:\n<Vault>/.obsidian/plugins/code-enhancer\n\nRequired files included:\n- manifest.json\n- main.js\n- versions.json\n`;
fs.writeFileSync(path.join(outDir, "README.txt"), readme, "utf8");

console.log(`Packaged plugin files to: ${outDir}`);
