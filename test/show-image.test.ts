import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Image, Text } from "@earendil-works/pi-tui";
import showImageExtension, { ENTRY_TYPE, renderShownImage, resolveImagePath } from "../index.ts";

const PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);
const theme = { fg: (_color: string, text: string) => text } as unknown as Theme;

function fixtures() {
	const dir = mkdtempSync(join(tmpdir(), "pi-show-image-test-"));
	const png = join(dir, "shot.png");
	const jpeg = join(dir, "photo.jpg");
	writeFileSync(png, PIXEL_PNG);
	writeFileSync(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
	return { dir, png, jpeg };
}

type Registered = {
	tool?: { execute: (...args: unknown[]) => Promise<{ content: Array<{ type: string; text?: string }> }> };
	command?: { handler: (args: string, ctx: unknown) => Promise<void> };
	entries: Array<{ customType: string; data: unknown }>;
};

function loadExtension(): Registered {
	const registered: Registered = { entries: [] };
	const pi = {
		registerEntryRenderer() {},
		registerTool(tool: Registered["tool"]) {
			registered.tool = tool;
		},
		registerCommand(_name: string, command: Registered["command"]) {
			registered.command = command;
		},
		appendEntry(customType: string, data: unknown) {
			registered.entries.push({ customType, data });
		},
	} as unknown as ExtensionAPI;
	showImageExtension(pi);
	return registered;
}

function runTool(registered: Registered, params: object, cwd: string, hasUI = true) {
	return registered.tool!.execute("call-1", params, undefined, undefined, { cwd, hasUI });
}

test("resolveImagePath expands ~ and resolves relative paths against cwd", () => {
	assert.equal(resolveImagePath("~/shots/a.png", "/work", "/home/me"), "/home/me/shots/a.png");
	assert.equal(resolveImagePath("~", "/work", "/home/me"), "/home/me");
	assert.equal(resolveImagePath(" shots/a.png ", "/work", "/home/me"), "/work/shots/a.png");
	assert.equal(resolveImagePath("/tmp/a.png", "/work", "/home/me"), "/tmp/a.png");
});

test("show_image records the resolved path and caption, and returns text only", async () => {
	const { dir } = fixtures();
	const registered = loadExtension();
	const result = await runTool(registered, { path: "shot.png", caption: " Login page " }, dir);
	assert.deepEqual(registered.entries, [
		{ customType: ENTRY_TYPE, data: { path: join(dir, "shot.png"), caption: "Login page" } },
	]);
	assert.deepEqual(
		result.content.map((part) => part.type),
		["text"],
	);
	assert.match(result.content[0]!.text!, /not sent to you/);
});

test("show_image rejects missing files, non-PNG files and sessions without a UI", async () => {
	const { dir, png, jpeg } = fixtures();
	const registered = loadExtension();
	await assert.rejects(runTool(registered, { path: "missing.png" }, dir), /No file at/);
	await assert.rejects(runTool(registered, { path: dir }, dir), /is not a file/);
	await assert.rejects(runTool(registered, { path: jpeg }, dir), /is not a still PNG/);
	await assert.rejects(runTool(registered, { path: png }, dir, false), /No interactive terminal/);
	await assert.rejects(runTool(registered, { path: "  " }, dir), /Give the path/);
	assert.deepEqual(registered.entries, []);
});

test("/show-image records the image, and notifies instead of throwing on errors", async () => {
	const { dir } = fixtures();
	const registered = loadExtension();
	const notices: string[] = [];
	const ctx = { cwd: dir, hasUI: true, ui: { notify: (message: string) => notices.push(message) } };
	await registered.command!.handler("shot.png", ctx);
	await registered.command!.handler("missing.png", ctx);
	assert.equal(registered.entries.length, 1);
	assert.equal(notices.length, 1);
	assert.match(notices[0]!, /No file at/);
});

test("renderShownImage draws the image, or a notice when the file is gone", () => {
	const { png, dir } = fixtures();
	const shown = renderShownImage({ path: png, caption: "Login page" }, theme);
	assert.deepEqual(
		shown.children.map((child) => child.constructor),
		[Text, Image],
	);
	const gone = renderShownImage({ path: join(dir, "gone.png") }, theme);
	assert.deepEqual(
		gone.children.map((child) => child.constructor),
		[Text, Text],
	);
});
