# Obsidian Pronounce 🔊

Add a discreet speaker button next to any word or phrase and hear its exact
pronunciation instantly — in any language, on any device. Built for language
learners who keep vocabulary tables and want a single click or tap, without
emoji-hunting or copy-pasting.

Existing TTS plugins (*Apple TTS*, *Text to Speech*, ...) are built to read
whole notes aloud for accessibility, and most rely on desktop-only binaries
(e.g. macOS's `say`) that don't work on mobile. Pronounce does the opposite:
it's a tiny, per-word `🔊` button built entirely on the standard
`window.speechSynthesis` API, no native binaries. In practice that means it
works great on **macOS, Windows, Linux, and iOS/iPadOS** (see the voice
quality note below for iOS); **Android is currently unsupported** — see
[Known limitations](#known-limitations).

> **Note on system voices.** Pronounce runs 100% locally and offline to
> protect your privacy — it relies entirely on your device's own speech
> engine, it never sends text anywhere. To get the most natural-sounding
> voices (e.g. *Alva Enhanced* for Swedish, *Samantha* for English), make
> sure the voice for your target language is downloaded on your device:
> - **macOS** — System Settings → Accessibility → Spoken Content → System
>   voice (or the VoiceOver Utility on macOS 15+).
> - **iOS (iPhone/iPad)** — Settings → Accessibility → Spoken Content →
>   Voices. Note: only the base/Compact tier is actually usable here — see
>   [Known limitations](#known-limitations).
> - **Windows** — Settings → Time & Language → Speech.
>
> Android isn't listed above because no voice setup will make this work
> there yet — see [Known limitations](#known-limitations).

## Features

- **Inline trigger, no emoji required.** Wrap a word in `~` and it turns into
  a `🔊` button, in both Reading view and Live Preview.
  - `~mot~` → speaker button using the note's current language.
  - `~bonjour:fr~` (or `~bonjour|fr~`) → forces French for that one word,
    regardless of context. Both the short code (`sv`) and the full BCP-47
    code (`sv-SE`) work — `~sked:sv~` and `~sked:sv-SE~` both call the
    Swedish voice.
  - Native Markdown `~~strikethrough~~` is never affected — the parser
    ignores a doubled-up delimiter.
  - The delimiter (`~` by default) is a single configurable character in
    Settings, in case it conflicts with another plugin.
- **Quick listen on selection.** Highlight any word or phrase, then:
  - Right-click → *Listen to pronunciation*, or
  - Run the **Listen to selection** command from the command palette
    (assign your own hotkey, e.g. `Cmd/Ctrl + Shift + S`, in
    Settings → Hotkeys), or
  - On mobile, add it to your toolbar above the keyboard: Settings →
    Mobile → *Manage toolbar options* → *Add global command* →
    **Listen to selection**.
- **Read a whole vocabulary note in one pass.** Run **Read marked words in
  note** to have every `~word~` in the open note read aloud top to bottom,
  with a short pause between each — a quick listening review of a whole
  table without clicking every button. Run the command again to stop
  partway through.
- **Slow down on repeat, Google Translate-style.** Say the same word or
  phrase again right after the first play — whether from the same `🔊`
  button, a different button for that same text elsewhere in the note, or
  the **Listen to selection** command — and it speaks at a separately
  configurable slow rate so you can pick apart each syllable. Say it again
  to go back to normal speed. It's a strict toggle keyed on the text itself
  (not a timer, and not tied to a specific button), so repeating the exact
  same word/phrase anywhere always alternates Normal → Slow → Normal.
- **Language switcher in the status bar.** A small badge (e.g. `🇸🇪 SV`) shows
  the language currently active for the open note. Click it — or run
  **Pronounce: Switch language** from the command palette — for an instant
  picker. When nothing has been forced (no manual pick, no frontmatter
  `lang`), the badge reads **`🏳️ Auto`** instead. Picking **🏳️ Auto** at the
  top of that menu clears any manual override for the note, handing control
  back to its frontmatter or the plugin default.
- **Strict, predictable language cascade.** No guessing which language will
  be used:
  1. Language forced inline on the word (`~word:en~`).
  2. Manual pick from the status bar / command palette (active for that note,
     for the rest of the session).
  3. The note's frontmatter:
     ```yaml
     ---
     lang: sv-SE
     ---
     ```
  4. The plugin's default language, set in Settings.
- **100% cross-platform.** Built exclusively on the standard
  `window.speechSynthesis` (Web Speech API) — no `child_process`, no system
  binaries. Same code path on desktop and mobile, works fully offline with
  on-device voices, and never sends your text anywhere.

## Settings

- **Default language** — used when nothing else in the cascade applies.
- **Voice** — pick a specific system voice for the default language (e.g.
  *Alva Enhanced* on macOS for Swedish). Voices are ranked automatically so
  Apple's Premium/Enhanced tiers and the OS's own default voice are offered
  first, and legacy novelty voices (Albert, Zarvox, ...) are pushed to the
  bottom and labeled `[Novelty]`. Download higher-quality voices from
  *System Settings → Accessibility → Spoken Content* (VoiceOver on
  macOS 15+) to get more/better options here.
- **Normal speech rate** — 0.5x–1.1x (defaults to 0.85x), used on the first
  click.
- **Slow speech rate** — 0.2x–0.8x (defaults to 0.4x), used on repeat clicks
  on the same word (the Google Translate-style slow-motion toggle). Both are
  independent sliders, so you can tune how slow "slow" actually is.
- **Pitch** — 0.8x–1.2x.
- **Show in context menu** — toggle the right-click *Listen to pronunciation*
  entry.
- **Inline delimiter** — the single character wrapping a word (default `~`).

## Installation

### From the Community Plugins browser (once published)

1. Settings → Community plugins → Browse.
2. Search for **Pronounce**.
3. Install, then enable it.

### Manual install

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/LouisVct/obsidian-pronounce/releases).
2. Copy them into `<your-vault>/.obsidian/plugins/pronounce/`.
3. Reload Obsidian and enable **Pronounce** in Settings → Community plugins.

### BRAT (beta testing)

Add `LouisVct/obsidian-pronounce` in the
[BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.

## Known limitations

- **Android doesn't work at all, and this can't be fixed from a plugin.**
  `window.speechSynthesis` simply doesn't exist in the Android WebView that
  Obsidian's mobile app is built on (Obsidian uses Capacitor, which embeds
  Android's system WebView, not Chrome) — it's a Chromium bug open since May
  2015 with no fix in sight, confirmed on
  [Obsidian's own forum](https://forum.obsidian.md/t/text-to-speech-broken-on-android-mobiles-tablets/113984):
  a moderator explicitly declined it as a third-party/upstream issue outside
  Obsidian's control. Every Web Speech API-based plugin hits this, not just
  Pronounce. `isDesktopOnly` is still `false` because the plugin's own code
  has no desktop-only dependency and fails gracefully (a console warning,
  not a crash) — it's the platform, not the plugin, that's the gap.
- **On iOS/iPadOS, downloaded Enhanced/Premium voices are never reachable —
  only the Compact/pre-installed tier is.** This is a platform limitation,
  not a bug in this plugin: WKWebView's implementation of the Web Speech API
  only exposes Compact voices, even when a higher-quality voice for that
  language has been downloaded and selected in Settings → Accessibility →
  Spoken Content. The only way around it is native `AVSpeechSynthesizer`
  access, unavailable to a web-based Obsidian plugin. Desktop platforms
  (macOS, Windows, Linux) aren't affected — Enhanced/Premium/Natural voices
  there are correctly detected and preferred.
- Voice availability and quality otherwise depend entirely on what's
  installed on the underlying OS/browser; the plugin can't bundle or
  download voices itself. If a language sounds robotic or doesn't speak at
  all, download that language's voice in your OS's accessibility settings —
  see the note on system voices above.

## Development

```bash
npm install
npm run dev    # esbuild in watch mode
npm run build  # type-check + production build
```

Symlink or copy the repo into a test vault's
`.obsidian/plugins/pronounce/` folder to iterate live.

Project layout:

```
obsidian-pronounce/
├── manifest.json         # Plugin metadata (id, name, version, isDesktopOnly: false)
├── package.json          # Build dependencies (obsidian, typescript, esbuild)
├── tsconfig.json
├── src/
│   ├── main.ts           # Entry point: commands, status bar, language cascade
│   ├── settings.ts       # Settings tab, persistence, language list
│   ├── ttsService.ts     # Wrapper around window.speechSynthesis
│   └── inlineWidget.ts   # Reading-mode processor + Live Preview (CodeMirror 6) widget
└── styles.css            # Speaker button + status bar styling (theme-aware)
```

## License

[MIT](LICENSE)

---

If Pronounce helps your language learning journey, consider [buying me a
coffee ☕](https://ko-fi.com/louisvicat) to support development!

Created by [Louis Vicat](https://louisvicat.com)
