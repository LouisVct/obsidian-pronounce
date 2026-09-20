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

## Features

- **Inline trigger, no emoji required.** Type a word followed by `::` and it
  turns into a `🔊` button, in both Reading view and Live Preview.
  - `mot::` → speaker button using the note's current language.
  - `bonjour::fr` → forces French for that one word, regardless of context.
  - The trigger sequence (`::` by default) is configurable in Settings, in
    case it conflicts with another plugin (e.g. Dataview inline fields).
- **Quick listen on selection.** Highlight any word or phrase, then:
  - Right-click → *Listen to pronunciation*, or
  - Run the **Pronounce selected text** command from the command palette
    (assign your own hotkey, e.g. `Cmd/Ctrl + Shift + S`, in
    Settings → Hotkeys).
- **Language switcher in the status bar.** A small badge (e.g. `🇸🇪 SV`) shows
  the language currently active for the open note. Click it — or run
  **Pronounce: Switch language** from the command palette — for an instant
  picker.
- **Strict, predictable language cascade.** No guessing which language will
  be used:
  1. Language forced inline on the word (`word::en`).
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
  *Alva* or *Klara* on macOS for Swedish).
- **Speech rate** — 0.5x–1.5x (defaults to 0.9x, slightly slower to make
  foreign sounds easier to catch).
- **Pitch** — 0.8x–1.2x.
- **Show in context menu** — toggle the right-click *Listen to pronunciation*
  entry.
- **Inline trigger** — the sequence typed after a word (default `::`).

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
