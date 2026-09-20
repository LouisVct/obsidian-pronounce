# Obsidian Pronounce 🔊

Add a discreet speaker button next to any word or phrase and hear its exact
pronunciation instantly — in any language, on any device. Built for language
learners who keep vocabulary tables and want a single click or tap, without
emoji-hunting or copy-pasting.

Existing TTS plugins (*Apple TTS*, *Text to Speech*, ...) are built to read
whole notes aloud for accessibility, and most rely on desktop-only binaries
(e.g. macOS's `say`) that don't work on mobile. Pronounce does the opposite:
it's a tiny, per-word `🔊` button that works identically on macOS, Windows,
Linux, iOS and Android.

> **Note on system voices.** Pronounce runs 100% locally and offline to
> protect your privacy — it relies entirely on your device's own speech
> engine, it never sends text anywhere. To get the most natural-sounding
> voices (e.g. *Alva Enhanced* for Swedish, *Samantha* for English), make
> sure the voice for your target language is downloaded on your device:
> - **macOS** — System Settings → Accessibility → Spoken Content → System
>   voice (or the VoiceOver Utility on macOS 15+).
> - **iOS (iPhone/iPad)** — Settings → Accessibility → Spoken Content →
>   Voices.
> - **Windows** — Settings → Time & Language → Speech.
> - **Android** — Settings → Accessibility → Text-to-speech output.

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
    Settings → Hotkeys).
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

- The mobile-toolbar quick-action button (above the keyboard) isn't wired up
  yet — on mobile, use text selection + the context menu instead. Tracked as
  a roadmap item.
- Voice availability and quality depend entirely on what's installed on the
  underlying OS/browser; the plugin can't bundle or download voices itself.
  If a language sounds robotic or doesn't speak at all, download that
  language's voice in your OS's accessibility settings — see the note on
  system voices above.
- **On iOS/iPadOS specifically, downloaded Enhanced/Premium voices are not
  reachable at all.** This is a platform limitation, not a bug in this
  plugin: WKWebView's implementation of the Web Speech API
  (`window.speechSynthesis`) only exposes the Compact/pre-installed voice
  tier, even when a higher-quality voice for that language has been
  downloaded and selected in Settings → Accessibility → Spoken Content. This
  has been reported by other developers hitting the same wall, and the only
  way around it is native `AVSpeechSynthesizer` access, which isn't
  available to a web-based Obsidian plugin. Desktop platforms (macOS,
  Windows, Linux) aren't affected — Enhanced/Premium voices there are
  correctly detected and preferred.

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

Created by [Louis Vicat](https://louisvicat.com)
