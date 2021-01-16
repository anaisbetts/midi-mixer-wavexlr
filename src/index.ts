import { Assignment } from "midi-mixer-plugin";

const foo = new Assignment("foo", {
  name: "Foo",
  mute: true,
});

const bar = new Assignment("bar", {
  name: "Bar",
});

const timeout = setInterval(() => {
  foo.setVolume(Math.random());
  bar.setVolume(Math.random());
}, 1000);

$MM.onClose(() => {
  clearTimeout(timeout);
});
