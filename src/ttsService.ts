export interface SpeakOptions {
	lang: string;
	voiceURI?: string;
	rate: number;
	pitch: number;
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
		if (preferredURI) {
			const preferred = candidates.find((v) => v.voiceURI === preferredURI);
			if (preferred) return preferred;
		}
		return candidates[0] ?? null;
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
