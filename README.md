# MIDI Mixer Template Plugin

Use this template to quickly create a plugin for MIDI Mixer. It uses [TypeScript](https://www.typescriptlang.org/), [Parcel](https://parceljs.org/), and [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) to provide an easy API and development environment with hot-loading built in!

## Usage

- Create a repository using this as a template
- Clone your repository in to `%appdata%/midi-mixer-app/plugins`
- Install Node (I'd recommend [Volta](https://volta.sh/))

``` bash
# install dependencies
npm ci
```

``` bash
# start dev environment
npm start

# production build
npm run build
```

To ensure that the created plugin is easy to use for other users, make sure to commit your `dist` folder with any changes so that it can be downloaded and placed directly in to the `plugins` folder with no build step for the user.

## API

See [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) for API documentation.

## Manifest

A few key items are configurable in your plugin's `package.json`.

- `prettyName`: The name of your plugin in the MM UI
- `description`: The description in the MM UI
- `version`: The version of the plugin in the MM UI
- `author`: Your name in the MM UI
- `main`: Must point to the built entry file for your plugin
- `settings`: An object of settings that will appear in the MM UI's Settings page for the plugin - see the [definition](https://github.com/midi-mixer/plugin-template/blob/main/package.json#L12-L23) and [fetching](https://github.com/midi-mixer/plugin-template/blob/main/src/index.ts#L3-L8)
