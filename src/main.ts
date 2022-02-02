import { Assignment, ButtonType } from "midi-mixer-plugin"
import WaveLinkClient from "./WaveLinkClient"
import WebSocket from "ws"

console.log(Assignment)

setTimeout(() => {
  console.log("HELLO")
  const wnd = globalThis as any
  wnd.WebSocket = WebSocket
  wnd.WaveLinkClient = new WaveLinkClient("windows")
  wnd.WaveLinkClient.setAppIsRunning(true)

  $MM.showNotification("This is a test")
}, 1000)

setInterval(() => {
  console.log("hi")
}, 10000)
