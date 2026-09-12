# Cozy Companions

An original, privacy-conscious pixel pet for Windows. Keep a tiny cat or puppy above your desktop, drag them anywhere, name them, recolour every coat layer, and watch them react to your cursor and keyboard activity.

> Cozy Companions is an independent project. It is inspired by the general desktop-pet genre and does not contain Comnyang code, artwork, sprites, branding, or copied animation frames.

## Download

Open the repository’s [latest release](https://github.com/gks-prog/Cozy-Companions/releases/tag/latest), download `Cozy-Companions-Setup-2.1.0.exe`, and run it.

Windows may show an unknown-publisher warning until the installer is signed with a commercial code-signing certificate.

## What’s new in 2.1

- Original crisp pixel cat and puppy, drawn at runtime with a tiny indexed-style palette
- Exact body, patch, and eye colour pickers
- Seven patterns: face mask, tuxedo, socks, spots, calico, tabby, and solid
- Alternating left/right typing paws without storing key identities
- Cursor gaze, quick-cursor pounce, petting, dragging, blink, groom, sleep, wake, happy, and startled reactions
- **Pixel** and preserved painted **Classic** styles, switchable at any time
- Body, patch, and eye palette tinting in both styles; seven authored marking shapes in Pixel
- Repeating 25/5 Pomodoro cycle with Windows notifications
- Optional 45-minute water reminders and hourly stretch reminders
- Local names, bond level, appearance, reminder preferences, and multi-monitor position memory
- No account, advertising, analytics, or network activity

## Controls

- **Click or rub:** give affection
- **Drag:** place the pet anywhere on any connected display
- **Move the cursor nearby:** eyes follow it; quick movement may trigger a pounce
- **Type:** the pet alternates its paws (only anonymous activity pulses are used)
- **Double-click:** open name and appearance customization
- **Right-click:** open the tray controls
- **Double-click the tray icon:** switch cat or puppy

## Privacy

The keyboard hook immediately discards the key code and emits only a throttled “typing happened” pulse with an alternating animation side. It never stores or transmits typed text, clipboard contents, window titles, or browsing activity. Preferences are stored locally in Electron’s application-data directory.

## Installer size

The installer uses maximum compression, a single x64 target, one Electron language, and ASAR packaging. Electron’s bundled Chromium runtime still accounts for most of the roughly 100 MB download. Pixel art itself is tiny; substantially reducing the installer further would require a future move from Electron to a native Windows/WebView2 or Tauri shell.

## Development

```bash
npm install
npm start
```

Run checks and create the Windows installer:

```bash
npm test
npm run dist
```

GitHub Actions builds on Windows and updates the public `latest` release.
