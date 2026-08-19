# Invisible AI Overlay Assistant

Cross-platform Electron overlay for a private, user-controlled AI chat workflow. This repository currently implements the Phase 0 scaffold plus the protected-window and secure-settings foundations.

## Prerequisites

Install a current Node.js LTS release (20 or newer), then run:

```bash
npm install
npm run dev
```

Use `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test` to verify the project.

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
