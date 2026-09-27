# Overlay Assistant

Cross-platform Electron overlay for a private, user-controlled chat workflow. It streams to OpenAI-compatible `/chat/completions` APIs, can OCR a selected screen/window, supports live microphone dictation through Deepgram, and can upload recordings to an OpenAI-compatible transcription API. Chat can use cloud providers or a running Ollama/llama.cpp server.

## Prerequisites

Install a current Node.js LTS release (20 or newer), then run:

```bash
npm install
npm run dev
```

Use `pnpm run build`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` to verify the project.

## Use

1. Open **Settings**, choose a cloud provider, Ollama, llama.cpp, or a custom endpoint. Cloud providers require a key; localhost servers can run without one. Presets fill in the endpoint and suggest current models; you can also type a model ID. Keys are write-only and encrypted by Electron safeStorage. **Save & test** saves the form and checks that connection.
2. Type a message and press `Enter` to send it. Use `Shift+Enter` for a newline. The model response streams into the chat; `Esc` or **Stop** aborts it.
3. Select **Capture** (or press the capture hotkey), choose a display/window, and wait for the OCR attachment chip. Remove a chip with its × button if needed.
4. Configure **Settings → Voice input**. Choose **Deepgram · live streaming** and enter a Deepgram key for live dictation, or **Record then transcribe (API)** for the existing upload workflow. Select **Live dictate** / **Dictate** (or use its hotkey), speak, then select **Stop**. Live mode streams microphone audio to Deepgram while listening; tentative words appear above the draft and finalized words are inserted into it. Review the text before sending. This captures your microphone, not meeting/system audio.

Typed messages, extracted screen text, and finished transcripts are sent to chat only when you press Send or Enter.

### Model providers

All chat providers use streaming OpenAI-format `/chat/completions` requests:

| Provider | Base URL                                                  | Default preset     |
| -------- | --------------------------------------------------------- | ------------------ |
| OpenAI   | `https://api.openai.com/v1`                               | `gpt-6-luna`       |
| Claude   | `https://api.anthropic.com/v1`                            | `claude-sonnet-5`  |
| Gemini   | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.8-flash` |

Existing saved models and endpoints are preserved. Modern OpenAI models use `max_completion_tokens`; Claude, Gemini, and older/custom models use `max_tokens`. The reasoning setting defaults to the provider's own behavior.

Under **Voice input**, configure a separate OpenAI-compatible transcription URL, model, and key when using Claude or Gemini for chat. A separate cloud transcription endpoint requires its own key. With OpenAI, leaving the transcription endpoint and key blank uses the chat connection.

Model and endpoint references: [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model), [Claude models](https://platform.claude.com/docs/en/models/overview), [Claude OpenAI compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai).

### Local chat models

Choose **Ollama (local)** (`http://localhost:11434/v1`) or **llama.cpp (local)** (`http://localhost:8080/v1`), start your server, and select **Load models**. Choose an installed/served model and use **Save & test**. Both use the existing streaming chat API. For another port or IPv6 loopback, edit the base URL (include `/v1`). You may also enter a model ID manually.

Keys are optional for `localhost`, `127.0.0.1`, and `[::1]`; authenticated local servers can still use a key. Changing chat endpoints clears the previous key when switching to localhost. Model discovery uses only a newly entered key or the key saved for that exact endpoint. Remote custom endpoints retain the existing key requirement.

The app connects to your server; it does not install models or manage GPU/NPU acceleration. Choose a small quantized model suitable for the memory available to your server. No local speech model is downloaded or run, and OCR remains Tesseract.

### Live voice input

Deepgram has its own encrypted transcription key, separate from your chat key. Its live mode defaults to `nova-3` and English (`en`); the model and language are configurable. It requires internet access and a Deepgram account with available usage credit. Switching voice providers requires a new key or clears the old one, so credentials are never carried between voice providers.

Audio is sent as ordered WebM/Opus fragments through the main process. Stop releases the microphone immediately, sends the last audio fragment, and waits for final words before enabling Send. Connection failures stop recording and preserve finalized text; start dictation again to reconnect. Reloading or closing the window closes the provider session. Audio buffers are bounded, and credentials never enter the renderer. Existing recording-upload mode has a 60-second request timeout.

References: [Ollama API compatibility](https://docs.ollama.com/api/openai-compatibility), [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [Deepgram streaming API](https://developers.deepgram.com/reference/speech-to-text/listen-streaming).

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

The artifacts are written to `release/` (`.dmg`/`.zip` on macOS; NSIS installer when packaged on Windows). If you want a prod distribution, they require your signing and notarization credentials.

## Security model

- The renderer is sandboxed with `contextIsolation: true` and `nodeIntegration: false`.
- Renderer privileges are exposed only through the typed bridge in `src/shared/ipc-contract.ts`.
- API keys never pass back to the renderer; they are encrypted with Electron `safeStorage` and committed atomically with their endpoints in `settings.json`. Existing separate key files migrate on the next successful settings save.
- The overlay requests Electron content protection whenever it is created or shown. Capture behavior still needs the manual matrix below; operating systems and capture software can vary.

## Manual Phase 1 capture gate

Before relying on the overlay in an interview, test Windows 10 2004+ and macOS 12+ in Zoom, Google Meet (browser tab and full-display sharing), and Microsoft Teams:

1. Open the overlay and confirm the green **Protected** indicator is present.
2. Test a full-screen/display share and confirm the overlay is not visible.
3. Test a window share and confirm the overlay is not visible.
4. Record any OS, client, GPU driver, or capture-method exceptions before proceeding to chat, OCR, or microphone features.

Content protection is a best-effort OS feature, not a guarantee against every capture path.

## Disclaimer

This is provided "as is", without warranty of any kind, express or implied,
including but not limited to the warranties of merchantability, fitness for a
particular purpose, and noninfringement.

The user assumes full responsibility for any use of this code. In no event shall
the author(s) or contributors be liable for any claim, damages, data loss, or other
liability, whether in an action of contract, tort, or otherwise, arising from, out of,
or in connection with the code or its use.

This project is intended for educational purposes only. Users are solely
responsible for ensuring their use complies with any and all applicable laws, regulations,
and third-party terms of service.
