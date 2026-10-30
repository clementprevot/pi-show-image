# @clementprevot/pi-show-image

A [Pi](https://pi.dev) extension that lets the agent show you a local image inline in the terminal, for example a screenshot it took during QA. Only you see the image: the agent gets back one line of text, so showing an image costs no image tokens.

## Install

```bash
pi install npm:@clementprevot/pi-show-image
```

Updates ship with `pi update --extensions`. The extension applies to your next session (quit and relaunch, or run `/reload`).

## Usage

The agent calls the `show_image` tool:

```json
{ "path": "/tmp/login-page.png", "caption": "Login page after the fix" }
```

- `path`: a local PNG file, absolute, relative to the working directory, or starting with `~/`.
- `caption` (optional): one line shown above the image.

You can show an image yourself with `/show-image <path>`.

To have your agent use it, add a line like this one to your instructions: "To show me an image, call `show_image` with its path."

## How it works

1. The tool resolves the path and checks that the file exists and is a PNG.
2. It records a custom session entry with the path and the caption, and nothing else: no image data lands in the session file.
3. An entry renderer reads the file and draws it with pi's `Image` component, at 60 cells wide. Pi picks the terminal image protocol (Kitty graphics or iTerm2) and falls back to a text placeholder on terminals without image support.
4. Custom entries never enter the model context, so the agent only sees the tool's text result.

Because the entry holds a path, a session reopened after the file was deleted shows a notice instead of the image.

## Limits

- PNG only. Kitty-protocol terminals (Kitty, Ghostty, WezTerm) only accept PNG, and pi converts other formats only for its own tool results. Convert other formats first, for example `sips -s format png photo.jpg --out photo.png` on macOS or `magick photo.jpg photo.png`.
- Interactive sessions only. In print or RPC mode the tool reports an error, since there is no terminal to draw in.
- Inside tmux or other multiplexers, images depend on pi's terminal detection and on the multiplexer forwarding the image protocol.

## Privacy and data

The extension reads the files you or the agent point it at and writes their paths to the session file. It makes no network calls and collects no data.

## Local development

```bash
npm install
npm test
npm run typecheck
```

To try the extension in a live session without installing it:

```bash
pi -e /path/to/this/repo
```

## License

[MIT](LICENSE)
