import { Assignment, ButtonType } from "midi-mixer-plugin"
import WaveLinkClient from "./WaveLinkClient"
import WebSocket from "ws"

// Give node.js Websocket superpowers
const wnd = globalThis as any
wnd.WebSocket = WebSocket

export interface Mixer {
  bgColor: string
  deltaLinked: number
  filters: Filter[]
  iconData: string
  inputType: number
  isAvailable: boolean
  isLinked: boolean
  isLocalInMuted: boolean
  isStreamInMuted: boolean
  localMixFilterBypass: boolean
  localVolumeIn: number
  mixId: string
  mixerName: string
  streamMixFilterBypass: boolean
  streamVolumeIn: number
}

export interface Filter {
  active: boolean
  filterID: string
  name: string
  pluginID: string
}

async function connectWithRetry(client: WaveLinkClient) {
  // NB: Every retry we move forward one port, 21 retries will
  // cycle the entire list twice
  let retries = 21

  while (retries > 0) {
    try {
      await client.tryToConnect()
      return false
    } catch (e) {
      client.reconnect()
      retries--

      if (retries < 0) throw e
    }
  }

  return false
}

function volumeMMToWaveLink(vol: number) {
  return Math.round(vol * 100.0)
}

function volumeWaveLinkToMM(vol: number) {
  return vol / 100.0
}

const mixerTypes = ["local", "stream"]
async function initialize() {
  const client = new WaveLinkClient("windows")

  // Leak client for debugging
  const wnd: any = globalThis
  wnd.waveLinkClient = client

  try {
    await connectWithRetry(client)
  } catch (e) {
    $MM.showNotification(`Couldn't connect to Wave Link software! ${e}`)
  }

  const mixerMap = (await client.getMixers()).reduce(
    (
      acc: Record<string, { mixer: Mixer; assignment: Assignment }>,
      mixer: Mixer
    ) => {
      // For each mixer, we create a fader for both the headphone and stream
      // output
      mixerTypes.forEach((type) => {
        const name = `${mixer.mixId}_${type}`
        const friendlyType = type === "local" ? "Headphone" : "Stream"
        const isLocal = type === "local"

        const [muted, volume] = isLocal
          ? [mixer.isLocalInMuted, mixer.localVolumeIn]
          : [mixer.isStreamInMuted, mixer.streamVolumeIn]

        const assign = new Assignment(name, {
          name: `${mixer.mixerName} - ${friendlyType}`,
          muted,
          volume: volumeWaveLinkToMM(volume),
        })

        // Set volume even harder
        setTimeout(() => {
          assign.volume = volumeWaveLinkToMM(volume)
        }, 100)

        assign.on("volumeChanged", (level: number) => {
          client.setVolume(
            "input",
            mixer.mixId,
            type,
            volumeMMToWaveLink(level)
          )
          assign.volume = level
        })

        client.setFilterBypass()

        assign.on("mutePressed", () => {
          client.setMute("input", mixer.mixId, type)
          assign.muted = isLocal ? mixer.isLocalInMuted : mixer.isStreamInMuted
        })

        acc[name] = { mixer, assignment: assign }
      })

      return acc
    },
    {}
  )

  console.log(`Found ${Object.keys(mixerMap).length} mixers`)
  console.log(mixerMap)
}

initialize()
