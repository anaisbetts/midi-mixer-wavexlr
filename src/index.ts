import { Assignment, ButtonType } from "midi-mixer-plugin";

/**
 * Example of retrieving the plugin's settings.
 */
$MM.getSettings().then((settings) => {
  console.log("settings:", settings);
});

/**
 * Example of setting up an assignment to be controlled by the plugin.
 */
const example = new Assignment("foo", {
  name: "Example Plugin Entry",
});

example.on("volumeChanged", (level: number) => {
  example.volume = level;
});

example.on("mutePressed", () => {
  example.muted = !example.muted;
});

example.on("assignPressed", () => {
  example.assigned = !example.assigned;
});

example.on("runPressed", () => {
  example.running = !example.running;
});

/**
 * Example of setting up a button type to be controlled by the plugin.
 */
const typeExample = new ButtonType("bar", {
  name: "Example Button Type",
});

typeExample.on("pressed", () => {
  typeExample.active = !typeExample.active;
});
