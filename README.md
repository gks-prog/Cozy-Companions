# Cozy Companions

A small, affectionate Windows desktop pet. Choose a white-and-brown puppy or kitten, drag it anywhere across your screens, pet it with the cursor, and watch it respond to your typing without recording what you type.

## Features

- Transparent, always-on-top Windows companion
- Puppy and kitten selector
- Custom pet names and five coat-colour themes
- Drag anywhere, including multi-monitor desktops
- Cursor tracking, clicking and stroking reactions
- Privacy-safe global typing activity reactions
- Sleep, wake, happy, startled and playful behaviours
- Local affection memory
- Optional launch with Windows
- Tray menu for switching pets, pausing reactions and quitting
- No accounts, ads, analytics or network access

## Install

Open this repository’s **Releases** page, download `Cozy-Companions-Setup-1.0.0.exe`, and run it.

Windows may warn about an unknown publisher until the installer is signed with a commercial code-signing certificate. That warning does not mean the app collects typed content; the source is included here for inspection.

## Controls

- **Click the pet:** show affection
- **Rub the cursor over the pet:** pet it
- **Drag the pet:** move it anywhere
- **Right-click the pet:** open controls
- **Double-click the tray icon:** switch puppy/kitten
- **Double-click the pet:** customize its name, species and coat

## Privacy

The keyboard listener discards key identities immediately and emits only a throttled “typing happened” pulse. No typed text, key code, clipboard content, window title or browsing activity is saved or transmitted. Pet preferences and affection are stored locally in Electron’s application data directory.

## Development

```bash
npm install
npm start
```

Create the Windows installer:

```bash
npm run dist
```

The included GitHub Actions workflow builds the installer on Windows and publishes it under the repository’s `latest` release.
