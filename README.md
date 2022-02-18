# MIDI Mixer + Wave XLR

This plugin allows you, along with MIDI Mixer, to control your Wave Link app via MIDI. Currently supports faders only.

## To build

```sh
npm install
npm run build
```

## To run locally (Windows)

Initial setup:

```sh
cmd
mklink /D C:\Path\to\this\checkout %AppData%/MIDI Mixer/plugins/wave-xlr
```

To build:

```
npx tsc
```
