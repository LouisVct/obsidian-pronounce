import { editorLivePreviewField } from "obsidian";
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

/** Builds a regex matching `word<trigger>` or `word<trigger><lang>`. */
export function buildTriggerRegex(trigger: string): RegExp {
	const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`([\\p{L}\\p{M}][\\p{L}\\p{M}0-9'’-]*)${escaped}([A-Za-z]{2}(?:-[A-Za-z]{2})?)?`, "gu");
}

export function findTriggerMatches(text: string, trigger: string): TriggerMatch[] {
	if (!trigger) return [];
	const regex = buildTriggerRegex(trigger);
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
	const btn = document.createElement("button");
	btn.addClass("pronounce-btn");
	btn.setAttr("type", "button");
	btn.setAttr("aria-label", `Pronounce "${word}"`);
	btn.setText("🔊");
	btn.addEventListener("mousedown", (evt) => evt.preventDefault());
	btn.addEventListener("click", (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		void plugin.pronounce(word, { forcedLang, sourcePath });
	});
	return btn;
}

/** Reading mode: walks rendered text nodes and swaps the trigger for a button. */
export function registerReadingModeProcessor(plugin: PronouncePlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const trigger = plugin.settings.triggerSequence;
		if (!trigger) return;

		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				const parent = node.parentElement;
				if (!parent) return NodeFilter.FILTER_REJECT;
				if (parent.closest("code, pre, a, .pronounce-btn")) return NodeFilter.FILTER_REJECT;
				if (!node.textContent || !node.textContent.includes(trigger)) return NodeFilter.FILTER_SKIP;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		const textNodes: Text[] = [];
		let current: Node | null;
		while ((current = walker.nextNode())) textNodes.push(current as Text);

		for (const node of textNodes) {
			const text = node.textContent ?? "";
			const matches = findTriggerMatches(text, trigger);
			if (matches.length === 0) continue;

			const frag = document.createDocumentFragment();
			let cursor = 0;
			for (const match of matches) {
				if (match.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, match.start)));
				frag.appendChild(document.createTextNode(match.word));
				frag.appendChild(createPronounceButton(plugin, match.word, match.lang, ctx.sourcePath));
				cursor = match.end;
			}
			if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
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
		return createPronounceButton(this.plugin, this.word, this.lang, this.sourcePath);
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

	const trigger = plugin.settings.triggerSequence;
	if (!trigger) return builder.finish();

	const sourcePath = plugin.app.workspace.getActiveFile()?.path;
	const selection = view.state.selection.main;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.sliceDoc(from, to);
		const matches = findTriggerMatches(text, trigger);

		for (const match of matches) {
			const wordEnd = from + match.start + match.word.length;
			const matchEnd = from + match.end;

			if (isInsideCode(view.state, from + match.start)) continue;
			// Keep the raw "word::lang" text editable while the cursor is inside it.
			if (selection.from <= matchEnd && selection.to >= from + match.start) continue;

			builder.add(
				wordEnd,
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
