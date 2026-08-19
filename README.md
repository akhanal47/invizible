# Invisible AI Overlay Assistant

Cross-platform Electron overlay for a private, user-controlled AI chat workflow. It streams to OpenAI-compatible `/chat/completions` APIs, can OCR a selected screen/window, and supports push-to-talk transcription via an OpenAI-compatible transcription endpoint.

## Prerequisites

Install a current Node.js LTS release (20 or newer), then run:

```bash
npm install
npm run dev
```

Use `pnpm run build`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` to verify the project.

## Use

1. Open **Settings** and enter an API base URL, model, and API key. The key is write-only and encrypted by Electron safeStorage.
2. Type a message and press `Enter` to send it. Use `Shift+Enter` for a newline. The model response streams into the chat; `Esc` or **Stop** aborts it.
3. Select **Capture** (or press the capture hotkey), choose a display/window, and wait for the OCR attachment chip. Remove a chip with its × button if needed.
4. Select **Mic** (or press its hotkey) to start recording; use it again to stop. The transcript is placed in the input field and is never sent until you press `Enter`.

The app never automatically sends typed text, OCR, or transcription.

### Fixed hotkeys

- `Cmd/Ctrl+Shift+Space` — show/hide overlay
- `Cmd/Ctrl+Shift+S` — choose OCR capture source
- `Cmd/Ctrl+Shift+M` — start/stop microphone recording
- `Cmd/Ctrl+Shift+Arrow` — move overlay 40 px
- `Esc` (in app) — stop response or close source picker

On macOS, grant **Screen Recording** permission before capture and **Microphone** permission before dictation. If a screen capture is blank, grant Screen Recording in System Settings, then restart the app.

## Packaging

Create unsigned development artifacts with:

```bash
pnpm package
```

Artifacts are written to `release/` (`.dmg`/`.zip` on macOS; NSIS installer when packaged on Windows). Production distribution still requires your signing and notarization credentials.

## Security model

- The renderer is sandboxed with `contextIsolation: true` and `nodeIntegration: false`.
- Renderer privileges are exposed only through the typed bridge in `src/shared/ipc-contract.ts`.
- API keys never pass back to the renderer; they are encrypted with Electron `safeStorage` and stored separately from `settings.json`.
- The overlay requests Electron content protection whenever it is created or shown. Capture behavior still needs the manual matrix below; operating systems and capture software can vary.

## Manual Phase 1 capture gate

Before relying on the overlay in an interview, test Windows 10 2004+ and macOS 12+ in Zoom, Google Meet (browser tab and full-display sharing), and Microsoft Teams:

1. Open the overlay and confirm the green **Protected** indicator is present.
2. Test a full-screen/display share and confirm the overlay is not visible.
3. Test a window share and confirm the overlay is not visible.
4. Record any OS, client, GPU driver, or capture-method exceptions before proceeding to chat, OCR, or microphone features.

Content protection is a best-effort OS feature, not a guarantee against every capture path.
