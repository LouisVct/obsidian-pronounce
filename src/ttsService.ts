export interface SpeakOptions {
	lang: string;
	voiceURI?: string;
	rate: number;
	pitch: number;
}

/**
 * macOS ships a set of legacy "novelty" voices (Mac OS 9 era) that sort
 * alphabetically before real voices and sound like a broken robot. They're
 * still valid `en-US` voices, so without this list they'd win the naive
 * "first match" voice pick.
 */
const NOVELTY_VOICE_NAMES = new Set(
	[
		"Albert",
		"Bad News",
		"Bahh",
		"Bells",
		"Boing",
		"Bubbles",
		"Cellos",
		"Deranged",
		"Good News",
		"Hysterical",
		"Junior",
		"Kathy",
		"Organ",
		"Ralph",
		"Superstar",
		"Trinoids",
		"Whisper",
		"Wobble",
		"Zarvox",
	].map((name) => name.toLowerCase())
);

const PREMIUM_VOICE_HINTS = ["enhanced", "premium", "siri"];

const KNOWN_NATURAL_VOICE_NAMES = new Set(
	[
		"Samantha",
		"Ava",
		"Alva",
		"Thomas",
		"Audrey",
		"Daniel",
		"Karen",
		"Moira",
		"Tessa",
		"Victoria",
		"Allison",
		"Susan",
		"Fiona",
		"Kate",
		"Serena",
		"Zoe",
		"Nicky",
		"Aaron",
		"Nathan",
		"Evan",
		"Tom",
	].map((name) => name.toLowerCase())
);

export function isNoveltyVoice(voice: SpeechSynthesisVoice): boolean {
	return NOVELTY_VOICE_NAMES.has(voice.name.trim().toLowerCase());
}

/**
 * Ranks a voice for a target language, highest is best. Priority mirrors
 * what a user actually wants to hear:
 * 1. The OS's own default voice for that language.
 * 2. An exact language/region match over a same-base-language partial match.
 * 3. Modern/"enhanced" voices, or well-known natural-sounding voice names.
 * Novelty voices are always penalized so they never win automatically.
 */
export function voiceQualityScore(voice: SpeechSynthesisVoice, lang: string): number {
	let score = 0;
	if (voice.default) score += 1_000_000;
	if (voice.lang.toLowerCase() === lang.toLowerCase()) score += 10_000;

	const name = voice.name.trim().toLowerCase();
	if (PREMIUM_VOICE_HINTS.some((hint) => name.includes(hint))) score += 100;
	if (KNOWN_NATURAL_VOICE_NAMES.has(name)) score += 50;
	if (isNoveltyVoice(voice)) score -= 1_000_000_000;

	return score;
}

/**
 * Thin wrapper around window.speechSynthesis (Web Speech API).
 * Deliberately avoids any Node/Electron API (child_process, `say`, ...) so the
 * exact same code path runs on desktop and on iOS/Android.
 */
export class TtsService {
	private voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

	isSupported(): boolean {
		return typeof window !== "undefined" && "speechSynthesis" in window;
	}

	/**
	 * Voices load asynchronously on most platforms (notably iOS/Android
	 * WebViews). This resolves once at least one voice is available, falling
	 * back to whatever is loaded after a short grace period.
	 */
	async getVoices(): Promise<SpeechSynthesisVoice[]> {
		if (!this.isSupported()) return [];
		const synth = window.speechSynthesis;

		const existing = synth.getVoices();
		if (existing.length > 0) return existing;

		if (!this.voicesPromise) {
			this.voicesPromise = new Promise((resolve) => {
				const handle = () => {
					const voices = synth.getVoices();
					if (voices.length > 0) {
						synth.removeEventListener("voiceschanged", handle);
						resolve(voices);
					}
				};
				synth.addEventListener("voiceschanged", handle);
				window.setTimeout(() => {
					synth.removeEventListener("voiceschanged", handle);
					resolve(synth.getVoices());
				}, 1000);
			});
		}
		return this.voicesPromise;
	}

	async getVoicesForLang(lang: string): Promise<SpeechSynthesisVoice[]> {
		const voices = await this.getVoices();
		const short = lang.split("-")[0].toLowerCase();
		return voices.filter(
			(v) => v.lang.toLowerCase() === lang.toLowerCase() || v.lang.toLowerCase().startsWith(short)
		);
	}

	async pickVoice(lang: string, preferredURI?: string): Promise<SpeechSynthesisVoice | null> {
		const candidates = await this.getVoicesForLang(lang);
		if (candidates.length === 0) return null;

		// An explicit user choice always wins, novelty voice or not.
		if (preferredURI) {
			const preferred = candidates.find((v) => v.voiceURI === preferredURI);
			if (preferred) return preferred;
		}

		// Automatic pick: never surface a novelty voice unless it's truly all we have.
		const serious = candidates.filter((v) => !isNoveltyVoice(v));
		const pool = serious.length > 0 ? serious : candidates;

		return [...pool].sort((a, b) => voiceQualityScore(b, lang) - voiceQualityScore(a, lang))[0] ?? null;
	}

	/**
	 * Speaks `text`. Must be called synchronously from within a user gesture
	 * handler (click/tap) on iOS/Android, otherwise the browser silently
	 * blocks playback.
	 */
	async speak(text: string, options: SpeakOptions): Promise<void> {
		if (!this.isSupported()) {
			console.warn("Pronounce: window.speechSynthesis is not available on this platform.");
			return;
		}
		const trimmed = text.trim();
		if (!trimmed) return;

		const synth = window.speechSynthesis;
		// Cancel anything in-flight so rapid clicks don't queue up utterances.
		synth.cancel();

		const utterance = new SpeechSynthesisUtterance(trimmed);
		utterance.lang = options.lang;
		utterance.rate = options.rate;
		utterance.pitch = options.pitch;

		const voice = await this.pickVoice(options.lang, options.voiceURI);
		if (voice) utterance.voice = voice;

		synth.speak(utterance);
	}

	cancel(): void {
		if (this.isSupported()) window.speechSynthesis.cancel();
	}
}
