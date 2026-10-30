import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { detectSupportedImageMimeTypeFromFile, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Image, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

export const ENTRY_TYPE = "show-image";
const WIDTH_CELLS = 60;

export type ShownImage = {
	path: string;
	caption?: string;
};

export function resolveImagePath(input: string, cwd: string, home = homedir()): string {
	const path = input.trim();
	if (path === "~") return home;
	if (path.startsWith("~/")) return resolve(home, path.slice(2));
	return resolve(cwd, path);
}

/** Throws errors whose message is shown as-is to the model or the user. */
export async function showImage(
	pi: Pick<ExtensionAPI, "appendEntry">,
	input: ShownImage,
	cwd: string,
	hasUI: boolean,
): Promise<string> {
	if (!input.path.trim()) throw new Error("Give the path of the image to show.");
	const path = resolveImagePath(input.path, cwd);
	let mimeType: string | null;
	try {
		if (!statSync(path).isFile()) throw new Error(`${path} is not a file.`);
		mimeType = await detectSupportedImageMimeTypeFromFile(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`No file at ${path}.`);
		throw error;
	}
	// Kitty-protocol terminals only accept PNG, and pi converts other formats only for its own tool results.
	if (mimeType !== "image/png") {
		throw new Error(
			`${path} is not a still PNG image. Convert it first, for example with \`sips -s format png <file> --out <file>.png\` on macOS or \`magick <file> <file>.png\`.`,
		);
	}
	if (!hasUI) throw new Error("No interactive terminal in this session: the image cannot be shown.");
	const caption = input.caption?.trim();
	pi.appendEntry<ShownImage>(ENTRY_TYPE, caption ? { path, caption } : { path });
	return `Showed ${path} to the user. The image was not sent to you.`;
}

export function renderShownImage(data: ShownImage | undefined, theme: Theme): Container {
	const container = new Container();
	if (!data?.path) {
		container.addChild(new Text(theme.fg("warning", "show-image: entry without a path"), 1, 0));
		return container;
	}
	const caption = data.caption ? `${data.caption} ` : "";
	container.addChild(new Text(`${theme.fg("accent", caption)}${theme.fg("muted", data.path)}`, 1, 0));
	let base64: string;
	try {
		base64 = readFileSync(data.path).toString("base64");
	} catch {
		container.addChild(new Text(theme.fg("warning", "The image file is no longer available."), 1, 0));
		return container;
	}
	container.addChild(
		new Image(
			base64,
			"image/png",
			{ fallbackColor: (text) => theme.fg("muted", text) },
			{ maxWidthCells: WIDTH_CELLS, filename: basename(data.path) },
		),
	);
	return container;
}

export default function showImageExtension(pi: ExtensionAPI): void {
	pi.registerEntryRenderer<ShownImage>(ENTRY_TYPE, (entry, _options, theme) => renderShownImage(entry.data, theme));

	pi.registerTool({
		name: "show_image",
		label: "Show image",
		description:
			"Show a local PNG image to the user, inline in the terminal. The image is not sent to you: use read when you need to look at it yourself.",
		promptSnippet: "Show a local PNG image (screenshot, chart) to the user inline in the terminal",
		promptGuidelines: [
			"Use show_image when the user should see an image, for example a screenshot taken during QA.",
			"show_image does not send the image to you; use read when you need to inspect it.",
		],
		parameters: Type.Object({
			path: Type.String({
				description: "Path to a local PNG file: absolute, relative to the working directory, or starting with ~/",
			}),
			caption: Type.Optional(Type.String({ description: "One line telling the user what the image shows" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const text = await showImage(pi, params, ctx.cwd, ctx.hasUI);
			return { content: [{ type: "text", text }], details: undefined };
		},
	});

	pi.registerCommand("show-image", {
		description: "Show a local PNG image inline: /show-image <path>",
		handler: async (args, ctx) => {
			try {
				await showImage(pi, { path: args }, ctx.cwd, ctx.hasUI);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
