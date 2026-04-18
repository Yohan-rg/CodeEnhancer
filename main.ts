import { Plugin } from "obsidian";
import { createCodeEnhancerExtensions } from "./src/extensions";
import { CodeEnhancerSettingTab } from "./src/settings";
import { CodeEnhancerSettings, DEFAULT_SETTINGS } from "./src/types";

export default class CodeEnhancerPlugin extends Plugin {
  settings!: CodeEnhancerSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerEditorExtension(createCodeEnhancerExtensions(this.settings));
    this.addSettingTab(new CodeEnhancerSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  reloadExtensions(): void {
    this.app.workspace.updateOptions();
  }
}
