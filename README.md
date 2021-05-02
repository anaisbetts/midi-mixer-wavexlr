# MIDI Mixer Template Plugin (Remote and Local)

Use this template to quickly create a plugin for MIDI Mixer. It uses [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), and [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) to provide an easy API and development environment with hot-loading and offline use built in.

## Getting started

- Create a repository using this template
- Clone your repository in to `%appdata%/midi-mixer-app/plugins`
- Install Node (I'd recommend [Volta](https://volta.sh/))

``` bash
# install dependencies
npm install
```

``` bash
# start dev environment
npm start

# production build
npm run build
```

## Deploying (local)

To ensure that the created plugin is easy to use for other users, make sure to commit your `dist` folder with any changes so that it can be downloaded and placed directly in to the `plugins` folder with no build step for the user.

- `npm run build` to build a production version
- Commit the `dist` folder to GitHub
- User downloads and extracts the plugin to their own `plugins` folder

## Deploying (remote)

- Deploy your `dist` folder to a host
- Can use JAMStack services (Vercel / Netlify / Cloudflare Pages)

## API

See [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) for API documentation.

## Manifest

A few key items are configurable in your plugin's `plugin.json`. [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) provides a schema for this at `plugin.schema.json`.

