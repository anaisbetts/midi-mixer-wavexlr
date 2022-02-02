"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const midi_mixer_plugin_1 = require("midi-mixer-plugin");
const WaveLinkClient_1 = __importDefault(require("./WaveLinkClient"));
const ws_1 = __importDefault(require("ws"));
console.log(midi_mixer_plugin_1.Assignment);
setTimeout(() => {
    console.log("HELLO");
    const wnd = globalThis;
    wnd.WebSocket = ws_1.default;
    wnd.WaveLinkClient = new WaveLinkClient_1.default("windows");
    wnd.WaveLinkClient.setAppIsRunning(true);
    $MM.showNotification("This is a test");
}, 1000);
setInterval(() => {
    console.log("hi");
}, 10000);
//# sourceMappingURL=main.js.map