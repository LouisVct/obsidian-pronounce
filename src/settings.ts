import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type PronouncePlugin from "./main";
import { isNoveltyVoice, voiceQualityScore } from "./ttsService";

export interface PronounceLanguage {
	code: string; // BCP-47, e.g. "sv-SE"
	label: string;
	flag: string;
}

/** Curated list of common languages for the status bar / settings pickers. */
export const LANGUAGES: PronounceLanguage[] = [
	{ code: "en-US", label: "English (US)", flag: "🇺🇸" },
	{ code: "en-GB", label: "English (UK)", flag: "🇬🇧" },
	{ code: "fr-FR", label: "Français", flag: "🇫🇷" },
	{ code: "sv-SE", label: "Svenska", flag: "🇸🇪" },
	{ code: "es-ES", label: "Español", flag: "🇪🇸" },
	{ code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
	{ code: "it-IT", label: "Italiano", flag: "🇮🇹" },
	{ code: "pt-PT", label: "Português", flag: "🇵🇹" },
	{ code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
	{ code: "nl-NL", label: "Nederlands", flag: "🇳🇱" },
	{ code: "pl-PL", label: "Polski", flag: "🇵🇱" },
	{ code: "ru-RU", label: "Русский", flag: "🇷🇺" },
	{ code: "ja-JP", label: "日本語", flag: "🇯🇵" },
	{ code: "ko-KR", label: "한국어", flag: "🇰🇷" },
	{ code: "zh-CN", label: "中文（简体）", flag: "🇨🇳" },
	{ code: "ar-SA", label: "العربية", flag: "🇸🇦" },
	{ code: "tr-TR", label: "Türkçe", flag: "🇹🇷" },
	{ code: "no-NO", label: "Norsk", flag: "🇳🇴" },
	{ code: "da-DK", label: "Dansk", flag: "🇩🇰" },
	{ code: "fi-FI", label: "Suomi", flag: "🇫🇮" },
	{ code: "el-GR", label: "Ελληνικά", flag: "🇬🇷" },
	{ code: "cs-CZ", label: "Čeština", flag: "🇨🇿" },
	{ code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
];

/** Resolves a loose code (e.g. "sv", "EN", "pt-br") to a known language entry. */
export function findLanguage(code: string): PronounceLanguage | undefined {
	const lower = code.trim().toLowerCase();
	if (!lower) return undefined;
	return (
		LANGUAGES.find((l) => l.code.toLowerCase() === lower) ??
		LANGUAGES.find((l) => l.code.toLowerCase().startsWith(lower.split("-")[0]))
	);
}

export interface PronounceSettings {
	/** Delimiter wrapping a word to turn it into a speaker button, e.g. "~" for ~word~. */
	triggerChar: string;
	/** BCP-47 code used when no other rule in the priority cascade applies. */
	defaultLanguage: string;
	rate: number;
	pitch: number;
	showInContextMenu: boolean;
	/** Preferred voiceURI per language code, set from the settings tab. */
	voicesByLanguage: Record<string, string>;
}

export const DEFAULT_SETTINGS: PronounceSettings = {
	triggerChar: "~",
	defaultLanguage: "en-US",
	rate: 0.85,
	pitch: 1.0,
	showInContextMenu: true,
	voicesByLanguage: {},
};

export class PronounceSettingTab extends PluginSettingTab {
	plugin: PronouncePlugin;

	constructor(app: App, plugin: PronouncePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Language" });

		new Setting(containerEl)
			.setName("Default language")
			.setDesc(
				"Used when a note has no lang frontmatter and no language was manually picked from the status bar."
			)
			.addDropdown((dropdown) => {
				for (const language of LANGUAGES) {
					dropdown.addOption(language.code, `${language.flag} ${language.label}`);
				}
				dropdown.setValue(this.plugin.settings.defaultLanguage);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
					this.display();
				});
			});

		const voiceSetting = new Setting(containerEl)
			.setName("Voice")
			.setDesc("Loading available voices for this language…");
		this.plugin.tts.getVoicesForLang(this.plugin.settings.defaultLanguage).then((voices) => {
			const baseDesc =
				voices.length > 0
					? "System voice used to read the default language above."
					: "No system voice found for this language on this device yet. It may need to be downloaded in your OS's accessibility settings, or the system default will be used.";

			const descFrag = document.createDocumentFragment();
			descFrag.appendChild(document.createTextNode(baseDesc));
			descFrag.appendChild(document.createElement("br"));
			descFrag.appendChild(
				document.createTextNode(
					"Tip: for natural HD voices (e.g. Alva Enhanced for Swedish), download them from System Settings → Accessibility → Spoken Content (VoiceOver on macOS 15+)."
				)
			);
			voiceSetting.setDesc(descFrag);

			voiceSetting.addDropdown((dropdown) => {
				dropdown.addOption("", "System default");
				const lang = this.plugin.settings.defaultLanguage;
				const sorted = [...voices].sort((a, b) => voiceQualityScore(b, lang) - voiceQualityScore(a, lang));
				for (const voice of sorted) {
					const label = isNoveltyVoice(voice)
						? `[Novelty] ${voice.name} (${voice.lang})`
						: `${voice.name} (${voice.lang})`;
					dropdown.addOption(voice.voiceURI, label);
				}
				dropdown.setValue(this.plugin.settings.voicesByLanguage[this.plugin.settings.defaultLanguage] ?? "");
				dropdown.onChange(async (value) => {
					this.plugin.settings.voicesByLanguage[this.plugin.settings.defaultLanguage] = value;
					await this.plugin.saveSettings();
				});
			});
		});

		containerEl.createEl("h3", { text: "Voice tuning" });

		new Setting(containerEl)
			.setName("Speech rate")
			.setDesc(
				"How fast the voice speaks. Lower is slower, useful for hearing foreign sounds clearly. Clicking the same word twice within 3 seconds always speaks it slowly, regardless of this setting."
			)
			.addSlider((slider) =>
				slider
					.setLimits(0.3, 1.1, 0.05)
					.setValue(this.plugin.settings.rate)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.rate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Pitch")
			.setDesc("Voice pitch.")
			.addSlider((slider) =>
				slider
					.setLimits(0.8, 1.2, 0.05)
					.setValue(this.plugin.settings.pitch)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.pitch = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Behavior" });

		new Setting(containerEl)
			.setName("Show in context menu")
			.setDesc('Adds a "Listen to pronunciation" entry to the editor right-click menu when text is selected.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showInContextMenu).onChange(async (value) => {
					this.plugin.settings.showInContextMenu = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Inline delimiter")
			.setDesc(
				'Wraps a word to turn it into a 🔊 button, e.g. "~word~". Add ":lang" or "|lang" right before the closing delimiter to force a language for that word, e.g. "~sked:sv~" or "~sked:sv-SE~" both call the Swedish voice. Change this single character if it conflicts with another plugin (the default "~" never collides with Dataview or Anki\'s "::" fields).'
			)
			.addText((text) =>
				text
					.setPlaceholder("~")
					.setValue(this.plugin.settings.triggerChar)
					.onChange(async (value) => {
						if (value.length !== 1) {
							new Notice("Pronounce: the inline delimiter must be exactly one character.");
							return;
						}
						this.plugin.settings.triggerChar = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
