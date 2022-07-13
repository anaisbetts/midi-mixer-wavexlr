import { Assignment, ButtonType, ButtonTypeData } from "midi-mixer-plugin"
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

// NB: These are not the same as Mixer and I want to :knife:
export interface MixerFromEvent {
  channelPos: number
  mixerId: string
  name: string
  inputType: number
  localVolIn: number
  streamVolIn: number
  isLinked: boolean
  deltaLinked: number
  isLocalMuteIn: boolean
  isStreamMuteIn: boolean
  isAvailable: boolean
  isNotBlockedLocal: boolean
  isNotBlockedStream: boolean
  bgColor: string
  icon: string
  iconData: string
  filters: FilterFromEvent[]
  localMixFilterBypass: boolean
  streamMixFilterBypass: boolean
  topSlider: string
}

export interface FilterFromEvent {
  active: boolean
  filterID: string
  name: string
  pluginID: string
}

export function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function connectWithRetry(client: WaveLinkClient) {
  // NB: Every retry we move forward one port with a total
  // of 10 possibilities
  let retries = 4 * 10

  while (retries >= 0) {
    try {
      await client.tryToConnect()
      return true
    } catch (e) {
      client.reconnect()

      retries--
      if (retries < 0) throw e

      // NB: If we have cycled through all ports, give it a longer delay;
      // if not, just give it a jittered pause
      await delay(retries % 10 == 0 ? 30 * 1000 : Math.random() * 250)
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
let mixerMap: Record<
  string,
  { mixer: Mixer | undefined; assignment: Assignment }
>
const buttonList: Record<string, ButtonType> = {}

function createMixerAssignment(
  client: WaveLinkClient,
  mixer: Mixer,
  type: string
) {
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
    client.setVolume("input", mixer.mixId, type, volumeMMToWaveLink(level))
    assign.volume = level
  })

  assign.on("mutePressed", () => {
    client.setMute("input", mixer.mixId, type)
    assign.muted = isLocal ? mixer.isLocalInMuted : mixer.isStreamInMuted
  })

  return { id: name, assignment: assign }
}

// Set up toggle buttons
function createButton(
  id: string,
  data: ButtonTypeData,
  pressed: (b: ButtonType) => unknown
) {
  const btn = new ButtonType(id, data)
  btn.on("pressed", () => pressed(btn))
  buttonList[id] = btn
}

function createFilterButton(
  client: WaveLinkClient,
  mixer: Mixer,
  filter: Filter
) {
  createButton(
    `${mixer.mixId}_${filter.filterID}`,
    {
      name: `${filter.name} on ${mixer.mixerName}`,
      active: filter.active,
    },
    (b) => {
      client.setFilter(mixer.mixId, filter.filterID)
      filter.active = b.active
    }
  )
}

async function rebuildMixerMap(client: WaveLinkClient) {
  return (await client.getMixers()).reduce(
    (
      acc: Record<string, { mixer: Mixer; assignment: Assignment }>,
      mixer: Mixer
    ) => {
      // For each mixer, we create a fader for both the headphone and stream
      // output
      mixerTypes.forEach((type) => {
        const assign = createMixerAssignment(client, mixer, type)
        acc[assign.id] = { mixer, assignment: assign.assignment }
      })

      mixer.filters.forEach((f) => {
        createFilterButton(client, mixer, f)
      })

      return acc
    },
    {}
  )
}

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

  //
  // Set up fader assignments
  //

  mixerMap = await rebuildMixerMap(client)

  // Monitor mixer level changes from Wave Link and update the faders
  //
  // deviceId example: pcm_out_01_v_00_sd2
  // mixerId examples: pcm_out_01_v_00_sd2_local, pcm_out_01_v_00_sd2_stream
  client.event!.on("inputMixerChanged", (deviceId: string) => {
    const mixer: MixerFromEvent = client.getMixer(deviceId)

    const streamMixer = mixerMap[`${deviceId}_stream`]
    const localMixer = mixerMap[`${deviceId}_local`]

    localMixer.assignment.muted = mixer.isLocalMuteIn
    localMixer.assignment.volume = volumeWaveLinkToMM(mixer.localVolIn)
    streamMixer.assignment.muted = mixer.isStreamMuteIn
    streamMixer.assignment.volume = volumeWaveLinkToMM(mixer.streamVolIn)

    // Update filter buttons
    mixer.filters.forEach((f) => {
      buttonList[`${deviceId}_${f.filterID}`].active = f.active
    })
  })

  //
  // Set up Buttons
  //

  createButton(
    "toggleMonitorState",
    {
      name: "Toggle Monitor Mix / Stream Mix in Headphones",
      active: (await client.getSwitchState()) === "StreamMix",
    },
    async (b) => {
      const current = await client.getSwitchState()
      const newState = current === "StreamMix" ? "LocalMix" : "StreamMix"

      await client.changeSwitchState(newState)
      b.active = newState === "StreamMix"
    }
  )

  // Channel is added or deleted
  client.event!.on("channelsChanged", async () => {
    // Removing all assignments
    Object.keys(mixerMap).forEach((mixerName) => {
      mixerMap[mixerName].assignment.remove()
    })

    // Adding all assignments
    mixerMap = await rebuildMixerMap(client)
  })

  console.log(`Found ${Object.keys(mixerMap).length} mixers`)
  console.log(mixerMap)

  // Volume sliders for output mix
  // Get current output volumes
  const outputVolume = await client.getMonitoringState()

  // Set up sliders for final headphone and stream output
  const localAndStream = [true, false]

  localAndStream.forEach((isLocal) => {
    // Create slider for monitor output
    const mixerVolume = isLocal
      ? outputVolume.localVolOut
      : outputVolume.streamVolOut

    const mixerMuted = isLocal
      ? outputVolume.isLocalMuteOut
      : outputVolume.isStreamMuteOut

    const mixer = new Assignment(
      `wavelink_monitor_${isLocal ? "local" : "stream"}_volume`,
      {
        name: isLocal ? `Monitor Mix Volume` : `Stream Mix Volume`,
        muted: mixerMuted,
        volume: volumeWaveLinkToMM(mixerVolume),
      }
    )

    // Set volume even harder
    setTimeout(() => {
      mixer.volume = volumeWaveLinkToMM(mixerVolume)
      mixer.muted = mixerMuted
    }, 100)

    const volType = isLocal ? "local" : "stream"
    mixer.on("volumeChanged", (level: number) => {
      client.setOutputVolume(volType, volumeMMToWaveLink(level))
    })

    mixer.on("mutePressed", () => {
      client.setMute("output", null, volType)
      mixer.muted = client.output!.isLocalMuteOut
    })

    client.event!.on("outputMixerChanged", () => {
      if (client.output) {
        mixer.volume = volumeWaveLinkToMM(
          isLocal ? client.output.localVolOut : client.output.streamVolOut
        )
        mixer.muted = isLocal
          ? client.output.isLocalMuteOut
          : client.output.isStreamMuteOut
      }
    })

    mixerMap[mixer.id] = { mixer: undefined, assignment: mixer }
  })
}

initialize().then(() => console.log("started!"))

// NB: Without this, Midi Mixer immediately terminates
setInterval(() => {
  console.log("")
}, 1 * 60 * 60 * 1000)
