import { editorLivePreviewField } from "obsidian";
// createEl/createFragment/createSpan are Obsidian's ambient globals (declared
// via `declare global` in obsidian.d.ts), not exports of the "obsidian" module.
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type PronouncePlugin from "./main";

export interface TriggerMatch {
	full: string;
	word: string;
	lang?: string;
	start: number;
	end: number;
}

function escapeRegex(char: string): string {
	return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex matching `~word~` or `~word:lang~` (lang may also be
 * separated with `|`). A negative lookbehind/lookahead around the delimiter
 * guards against Obsidian's native `~~strikethrough~~` when the delimiter is
 * `~`, and more generally against a doubled-up delimiter of any kind.
 */
export function buildTriggerRegex(triggerChar: string): RegExp {
	const t = escapeRegex(triggerChar);
	// Any char but the delimiter, a lang separator, or a newline.
	const wordChar = `(?:(?!${t})[^:|\\n])`;
	return new RegExp(
		`(?<!${t})${t}(${wordChar}+?)(?:[:|]([A-Za-z]{2}(?:-[A-Za-z]{2})?))?${t}(?!${t})`,
		"gu"
	);
}

export function findTriggerMatches(text: string, triggerChar: string): TriggerMatch[] {
	if (!triggerChar) return [];
	const regex = buildTriggerRegex(triggerChar);
	const matches: TriggerMatch[] = [];
	let m: RegExpExecArray | null;
	while ((m = regex.exec(text)) !== null) {
		matches.push({
			full: m[0],
			word: m[1],
			lang: m[2]?.toLowerCase(),
			start: m.index,
			end: m.index + m[0].length,
		});
		// Avoid an infinite loop on zero-length matches.
		if (m.index === regex.lastIndex) regex.lastIndex++;
	}
	return matches;
}

export function createPronounceButton(
	plugin: PronouncePlugin,
	word: string,
	forcedLang: string | undefined,
	sourcePath: string | undefined
): HTMLButtonElement {
	const btn = createEl("button", {
		cls: "pronounce-btn",
		text: "🔊",
		attr: { type: "button", "aria-label": `Pronounce "${word}"` },
	});
	btn.addEventListener("mousedown", (evt) => evt.preventDefault());
	btn.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void plugin.pronounce(word, { forcedLang, sourcePath });
	});
	return btn;
}

/** Reading mode: walks rendered text nodes and swaps `~word:lang~` for `word 🔊`. */
export function registerReadingModeProcessor(plugin: PronouncePlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const triggerChar = plugin.settings.triggerChar;
		if (!triggerChar) return;

		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				const parent = node.parentElement;
				if (!parent) return NodeFilter.FILTER_REJECT;
				if (parent.closest("code, pre, a, .pronounce-btn")) return NodeFilter.FILTER_REJECT;
				if (!node.textContent || !node.textContent.includes(triggerChar)) return NodeFilter.FILTER_SKIP;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		const textNodes: Text[] = [];
		let current: Node | null;
		while ((current = walker.nextNode())) textNodes.push(current as Text);

		for (const node of textNodes) {
			const text = node.textContent ?? "";
			const matches = findTriggerMatches(text, triggerChar);
			if (matches.length === 0) continue;

			const frag = createFragment();
			let cursor = 0;
			for (const match of matches) {
				if (match.start > cursor) frag.appendText(text.slice(cursor, match.start));
				frag.appendText(match.word);
				frag.appendChild(createPronounceButton(plugin, match.word, match.lang, ctx.sourcePath));
				cursor = match.end;
			}
			if (cursor < text.length) frag.appendText(text.slice(cursor));
			node.parentNode?.replaceChild(frag, node);
		}
	});
}

class PronounceWidget extends WidgetType {
	constructor(
		private plugin: PronouncePlugin,
		private word: string,
		private lang: string | undefined,
		private sourcePath: string | undefined
	) {
		super();
	}

	eq(other: PronounceWidget): boolean {
		return other.word === this.word && other.lang === this.lang && other.sourcePath === this.sourcePath;
	}

	toDOM(): HTMLElement {
		const span = createSpan({ cls: "pronounce-inline" });
		span.appendText(this.word);
		span.appendChild(createPronounceButton(this.plugin, this.word, this.lang, this.sourcePath));
		return span;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function isInsideCode(state: EditorState, pos: number): boolean {
	const nodeName = syntaxTree(state).resolveInner(pos, 1).name;
	return /codeblock|inline-code|hmd-codeblock|formatting-code/i.test(nodeName);
}

function buildDecorations(view: EditorView, plugin: PronouncePlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	// Only decorate in Live Preview, never in raw source mode.
	if (!view.state.field(editorLivePreviewField, false)) return builder.finish();

	const triggerChar = plugin.settings.triggerChar;
	if (!triggerChar) return builder.finish();

	const sourcePath = plugin.app.workspace.getActiveFile()?.path;
	const selection = view.state.selection.main;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.sliceDoc(from, to);
		const matches = findTriggerMatches(text, triggerChar);

		for (const match of matches) {
			const matchStart = from + match.start;
			const matchEnd = from + match.end;

			if (isInsideCode(view.state, matchStart)) continue;
			// Keep the raw "~word:lang~" text editable while the cursor is inside it.
			if (selection.from <= matchEnd && selection.to >= matchStart) continue;

			builder.add(
				matchStart,
				matchEnd,
				Decoration.replace({
					widget: new PronounceWidget(plugin, match.word, match.lang, sourcePath),
				})
			);
		}
	}

	return builder.finish();
}

export function createPronounceViewPlugin(plugin: PronouncePlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged || update.selectionSet) {
					this.decorations = buildDecorations(update.view, plugin);
				}
			}
		},
		{
			decorations: (v) => v.decorations,
		}
	);
}
