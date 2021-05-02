# Template Plugin

This is a template plugin that demonstrates how to interact with MIDI Mixer's API in order to register buttons and groups, as well as provide a good user experience for your users.

This file is a `PAGE.md` file specified in the plugin's folder, and is simply a rendered markdown file. This can include a huge variety of formatting and is great for letting your users know how to use the plugin you've developed.

## Examples

For code examples of how to interact with MIDI Mixer, check out the `src` directory in the plugin itself.

## Settings

One of the crucial parts of developing a plugin (and something not documented directly in code) is the JSON definition of settings. Notarised using TypeScript, the `settings` key in your `package.json` file can be described like so:

```ts
interface PluginSetting {
  /**
   * The label for the field to be shown in the plugin's settings page.
   */
  label: string;

  /**
   * If marked as `true`, this field will be marked as required in the user's
   * UI.
   */
  required?: boolean;

  /**
   * The input type for this setting.
   */
  type: "text" | "password" | "status" | "button";

  /**
   * If no input has been given by either the user or the plugin, you can
   * provide an optional string for the value to fall back to.
   */
  fallback?: string;
}

type PluginSettings = Record<string, PluginSetting>;
```


