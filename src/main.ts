import { Editor, Menu, Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, findLanguage, LANGUAGES, PronounceSettings, PronounceSettingTab } from "./settings";
import { TtsService } from "./ttsService";
import { createPronounceViewPlugin, registerReadingModeProcessor } from "./inlineWidget";

interface PronounceOptions {
	forcedLang?: string;
	sourcePath?: string;
}

/** Repeat-click window: a 2nd click on the same word within this delay speaks it slowly. */
const REPEAT_CLICK_WINDOW_MS = 3000;

export default class PronouncePlugin extends Plugin {
	settings: PronounceSettings;
	tts: TtsService = new TtsService();

	/** Priority 2 of the language cascade: a manual pick from the status bar, kept for the session only. */
	private sessionLanguageByFile: Map<string, string> = new Map();
	private statusBarEl: HTMLElement;

	/** Google Translate-style repeat-click: 2nd click on the same word soon after speaks it slowly. */
	private lastSpokenText: string | null = null;
	private lastSpokenAt = 0;
	private lastSpokenWasSlow = false;

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
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Strict priority cascade:
	 * 1. Language forced inline on the word (word::en)
	 * 2. Manual pick from the status bar / command palette, for this note this session
	 * 3. `lang` frontmatter of the open note
	 * 4. Plugin default language
	 */
	resolveLanguage(sourcePath: string | undefined, forcedLang?: string): string {
		if (forcedLang) {
			const forced = findLanguage(forcedLang);
			if (forced) return forced.code;
		}

		if (sourcePath) {
			const sessionLang = this.sessionLanguageByFile.get(sourcePath);
			if (sessionLang) return sessionLang;

			const file = this.app.vault.getAbstractFileByPath(sourcePath);
			if (file instanceof TFile) {
				const frontmatterLang = this.app.metadataCache.getFileCache(file)?.frontmatter?.lang;
				if (typeof frontmatterLang === "string") {
					const fromFrontmatter = findLanguage(frontmatterLang);
					if (fromFrontmatter) return fromFrontmatter.code;
				}
			}
		}

		return this.settings.defaultLanguage;
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
	 * Google Translate-style repeat-click: the first click on a word speaks it
	 * at the configured rate; a 2nd click on that same word within
	 * REPEAT_CLICK_WINDOW_MS speaks it slowly; the click after that (or one
	 * arriving once the window has lapsed) starts the cycle over at normal
	 * speed.
	 */
	private nextPronounceRate(text: string): number {
		const now = Date.now();
		const isRepeat = this.lastSpokenText === text && now - this.lastSpokenAt <= REPEAT_CLICK_WINDOW_MS;
		const useSlowRate = isRepeat && !this.lastSpokenWasSlow;

		this.lastSpokenText = text;
		this.lastSpokenAt = now;
		this.lastSpokenWasSlow = useSlowRate;

		return useSlowRate ? Math.max(0.2, this.settings.rate * 0.5) : this.settings.rate;
	}

	openLanguageMenu(evt?: MouseEvent): void {
		const menu = new Menu();
		const activeFile = this.app.workspace.getActiveFile();

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
		const code = this.resolveLanguage(activeFile?.path);
		const language = findLanguage(code);
		const shortCode = code.split("-")[0].toUpperCase();

		this.statusBarEl.setText(language ? `${language.flag} ${shortCode}` : shortCode);
		this.statusBarEl.setAttr("aria-label", `Pronounce language: ${language?.label ?? code} (click to change)`);
	}
}
