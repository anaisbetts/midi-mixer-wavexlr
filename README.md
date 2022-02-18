# MIDI Mixer + Wave Link

This plugin allows you, along with MIDI Mixer, to control your Wave Link app via MIDI. Currently supports faders only.

## How do I use this??

Go to the Releases on the sidebar and download the latest release, then double-click it. MIDI Mixer will install it, and you can activate it in the Plugins section of the app.

## For Developers:

### To build

```sh
npm install
npm run build
```

### To run locally for debugging (Windows)

Initial setup:

```sh
cmd
mklink /D C:\Path\to\this\checkout %AppData%/MIDI Mixer/plugins/wave-xlr
```

To build:

```
npx tsc
```
