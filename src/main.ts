import { Editor, Menu, Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, findLanguage, LANGUAGES, PronounceSettings, PronounceSettingTab } from "./settings";
import { TtsService } from "./ttsService";
import { createPronounceViewPlugin, registerReadingModeProcessor } from "./inlineWidget";

interface PronounceOptions {
	forcedLang?: string;
	sourcePath?: string;
}

interface LanguageState {
	code: string;
	/** True when nothing forced this language: no session override, no frontmatter `lang`. */
	isAuto: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export default class PronouncePlugin extends Plugin {
	settings: PronounceSettings;
	tts: TtsService = new TtsService();

	/** Priority 2 of the language cascade: a manual pick from the status bar, kept for the session only. */
	private sessionLanguageByFile: Map<string, string> = new Map();
	private statusBarEl: HTMLElement;

	/** Google Translate-style toggle: clicking the same word again always flips Normal <-> Slow. */
	private lastSpokenText: string | null = null;
	private isSlowToggle = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass("pronounce-status-bar");
		this.registerDomEvent(this.statusBarEl, "click", (evt) => this.openLanguageMenu(evt));
		this.updateStatusBar();

		registerReadingModeProcessor(this);
		this.registerEditorExtension(createPronounceViewPlugin(this));

		this.addCommand({
			id: "pronounce-selection",
			name: "Pronounce selected text",
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection.trim()) {
					new Notice("Pronounce: select some text first.");
					return;
				}
				void this.pronounce(selection, { sourcePath: this.app.workspace.getActiveFile()?.path });
			},
		});

		this.addCommand({
			id: "pronounce-switch-language",
			name: "Switch language",
			callback: () => this.openLanguageMenu(),
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (!this.settings.showInContextMenu) return;
				const selection = editor.getSelection();
				if (!selection.trim()) return;
				menu.addItem((item) =>
					item
						.setTitle("Listen to pronunciation")
						.setIcon("volume-2")
						.onClick(() => void this.pronounce(selection, { sourcePath: this.app.workspace.getActiveFile()?.path }))
				);
			})
		);

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateStatusBar()));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.path === this.app.workspace.getActiveFile()?.path) this.updateStatusBar();
			})
		);

		this.addSettingTab(new PronounceSettingTab(this.app, this));
	}

	onunload(): void {
		this.tts.cancel();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Defend against stale values from an older settings shape (e.g. a rate
		// saved back when the slider allowed up to 1.5, or a renamed field
		// leaving triggerChar unset) rather than letting the UI silently clamp.
		this.settings.rate = clamp(this.settings.rate, 0.5, 1.1);
		this.settings.slowRate = clamp(this.settings.slowRate, 0.2, 0.8);
		this.settings.pitch = clamp(this.settings.pitch, 0.8, 1.2);
		if ([...this.settings.triggerChar].length !== 1) {
			this.settings.triggerChar = DEFAULT_SETTINGS.triggerChar;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Priorities 2-4 of the language cascade: session override, then note
	 * frontmatter, then the plugin default. `isAuto` is true only when
	 * neither of the first two applied, i.e. the default is what's active.
	 */
	private getLanguageState(sourcePath: string | undefined): LanguageState {
		if (sourcePath) {
			const sessionLang = this.sessionLanguageByFile.get(sourcePath);
			if (sessionLang) return { code: sessionLang, isAuto: false };

			const file = this.app.vault.getAbstractFileByPath(sourcePath);
			if (file instanceof TFile) {
				const frontmatterLang = this.app.metadataCache.getFileCache(file)?.frontmatter?.lang;
				if (typeof frontmatterLang === "string") {
					const fromFrontmatter = findLanguage(frontmatterLang);
					if (fromFrontmatter) return { code: fromFrontmatter.code, isAuto: false };
				}
			}
		}

		return { code: this.settings.defaultLanguage, isAuto: true };
	}

	/**
	 * Strict priority cascade:
	 * 1. Language forced inline on the word (~word:en~)
	 * 2. Manual pick from the status bar / command palette, for this note this session
	 * 3. `lang` frontmatter of the open note
	 * 4. Plugin default language
	 */
	resolveLanguage(sourcePath: string | undefined, forcedLang?: string): string {
		if (forcedLang) {
			const forced = findLanguage(forcedLang);
			if (forced) return forced.code;
		}
		return this.getLanguageState(sourcePath).code;
	}

	async pronounce(text: string, options: PronounceOptions = {}): Promise<void> {
		const lang = this.resolveLanguage(options.sourcePath, options.forcedLang);
		const voiceURI = this.settings.voicesByLanguage[lang];
		const rate = this.nextPronounceRate(text);
		await this.tts.speak(text, {
			lang,
			voiceURI,
			rate,
			pitch: this.settings.pitch,
		});
	}

	/**
	 * Google Translate-style toggle: the same word spoken twice in a row
	 * flips between normal and slow speed on every click. Speaking a
	 * different word always resets the cycle back to normal.
	 */
	private nextPronounceRate(text: string): number {
		if (this.lastSpokenText === text) {
			this.isSlowToggle = !this.isSlowToggle;
		} else {
			this.lastSpokenText = text;
			this.isSlowToggle = false;
		}

		return this.isSlowToggle ? this.settings.slowRate : this.settings.rate;
	}

	openLanguageMenu(evt?: MouseEvent): void {
		const menu = new Menu();
		const activeFile = this.app.workspace.getActiveFile();

		menu.addItem((item) =>
			item.setTitle("🏳️ Auto (note frontmatter / default)").onClick(() => {
				if (activeFile) {
					this.sessionLanguageByFile.delete(activeFile.path);
					this.updateStatusBar();
				}
				new Notice("Pronounce: reset to auto (note frontmatter or default).");
			})
		);
		menu.addSeparator();

		for (const language of LANGUAGES) {
			menu.addItem((item) =>
				item.setTitle(`${language.flag} ${language.label}`).onClick(() => {
					if (activeFile) {
						this.sessionLanguageByFile.set(activeFile.path, language.code);
						this.updateStatusBar();
					}
					new Notice(`Pronounce: ${language.label} selected for this note.`);
				})
			);
		}

		if (evt) {
			menu.showAtMouseEvent(evt);
		} else {
			const rect = this.statusBarEl.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.top });
		}
	}

	updateStatusBar(): void {
		const activeFile = this.app.workspace.getActiveFile();
		const { code, isAuto } = this.getLanguageState(activeFile?.path);
		const language = findLanguage(code);

		if (isAuto) {
			this.statusBarEl.setText("🏳️ Auto");
			this.statusBarEl.setAttr(
				"aria-label",
				`Pronounce language: Auto — currently "${language?.label ?? code}" (plugin default). Click to override.`
			);
			return;
		}

		const shortCode = code.split("-")[0].toUpperCase();
		this.statusBarEl.setText(language ? `${language.flag} ${shortCode}` : shortCode);
		this.statusBarEl.setAttr("aria-label", `Pronounce language: ${language?.label ?? code} (click to change)`);
	}
}
