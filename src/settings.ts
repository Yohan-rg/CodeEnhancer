import { App, PluginSettingTab, Setting } from "obsidian";
import type CodeEnhancerPlugin from "../main";

export class CodeEnhancerSettingTab extends PluginSettingTab {
  plugin: CodeEnhancerPlugin;

  constructor(app: App, plugin: CodeEnhancerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Code Enhancer" });

    this.addToggle(containerEl, "Language-aware autocomplete", "Enable keyword/snippet completions in fenced code blocks.", "enableAutocomplete");
    this.addToggle(containerEl, "Auto indentation", "Indent/dedent based on language block rules on Enter.", "enableAutoIndent");
    this.addToggle(containerEl, "Auto-close HTML/XML tags", "Insert matching closing tags in HTML/XML blocks.", "enableAutoCloseTags");
    this.addToggle(containerEl, "Smart bracket pairing", "Auto-close (), {}, [], quotes and skip duplicates.", "enableSmartPairs");
    this.addToggle(containerEl, "Tab-based indent", "Tab indents / Shift+Tab outdents selection inside code blocks.", "enableTabIndent");
    this.addToggle(containerEl, "Comment toggling", "Use Mod+/ to toggle comments based on language.", "enableCommentToggle");
    this.addToggle(containerEl, "Syntax highlighting enhancement", "Apply an additional semantic highlight layer.", "enableSyntaxHighlight");
    this.addToggle(containerEl, "Snippets", "Enable configurable trigger-based snippets.", "enableSnippets");
    this.addToggle(containerEl, "Lint-like feedback", "Show diagnostics for unclosed tags/brackets and indentation issues.", "enableLint");

    new Setting(containerEl)
      .setName("Indent size")
      .setDesc("Spaces inserted per indentation level.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 8, 1)
          .setValue(this.plugin.settings.indentSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.indentSize = value;
            await this.plugin.saveSettings();
            this.plugin.reloadExtensions();
          })
      );

    new Setting(containerEl)
      .setName("Snippets (JSON)")
      .setDesc("Map language -> trigger -> template. Use ${cursor} for cursor placement.")
      .addTextArea((text) => {
        text
          .setPlaceholder('{"javascript":{"fn":"function ${name}() {\\n  ${cursor}\\n}"}}')
          .setValue(JSON.stringify(this.plugin.settings.snippets, null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === "object" && parsed !== null) {
                this.plugin.settings.snippets = parsed;
                await this.plugin.saveSettings();
                this.plugin.reloadExtensions();
                text.inputEl.removeClass("is-invalid");
              }
            } catch {
              text.inputEl.addClass("is-invalid");
            }
          });

        text.inputEl.rows = 12;
        text.inputEl.style.width = "100%";
      });
  }

  private addToggle(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: keyof CodeEnhancerPlugin["settings"]
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) =>
        toggle.setValue(Boolean(this.plugin.settings[key])).onChange(async (value) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.plugin.settings as any)[key] = value;
          await this.plugin.saveSettings();
          this.plugin.reloadExtensions();
        })
      );
  }
}
