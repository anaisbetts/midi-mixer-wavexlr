# [MIDI Mixer](https://www.midi-mixer.com/) + Wave Link

This plugin allows you, along with [MIDI Mixer](https://www.midi-mixer.com/), to control your Wave Link app via MIDI.

## What can I control with this?

- Set both Headphone / Stream volume in Wave Link for all channels
- Toggle Monitor / Stream in headphones
- Toggle VST Filters
- Control Stream / Monitor Mix output volume

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
mklink /D %AppData%/midi-mixer-app/plugins/midi-mixer-wave-xlr C:\Path\to\this\checkout
```

To build:

```
npx tsc
```
