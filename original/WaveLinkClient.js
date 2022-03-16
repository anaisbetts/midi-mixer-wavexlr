class WaveLinkClient {

    static instance;

    constructor(system) {
        if (WaveLinkClient.instance) {
            //debug("WLC Instance returned.");
            return WaveLinkClient.instance;
        }
        //debug("No WLC Instance found...");
        WaveLinkClient.instance = this;
        this.init(system);
    }
    
    init(system) {
        debug("Init WLC...");
        this.host = "127.0.0.1";

        this.startPort = 1824;
        this.endPort = this.startPort + 10;
        this.port = this.startPort;

        this.UP_MAC = system == 'mac' ? true : false; 
        this.UP_WINDOWS = system == 'windows' ? true : false;

        this.minimumMajorRelease = 1;
        this.minimumMinorRelease = 4;
        this.minimumPatch = 1;
        this.minimumBuild = this.UP_WINDOWS ? 2758 : 2913;

        this.isWLUpToDate = false;

        this.appIsRunning = false;
        this.isConnected = false;
        this.isKeyUpdated = false;

        this.event = ELGEvents.eventEmitter();
        this.on = this.event.on;
        this.emit = this.event.emit;

        this.awl = new AppWaveLink;
        this.rpc = new simple_jsonrpc();

        this.websocket = null;
        
        this.output = null;
        this.mixers = [];
        
        this.isMicrophoneConnected;
        this.micSettings;
        this.localOutputList;
        this.selectedMonitorMix;
        this.switchState;
        
        this.fadingDelay = 100;
    }

    tryToConnect() {
        if (this.appIsRunning) {
            debug("Trying to connect to port: " + this.port);
            this.websocket = new WebSocket("ws://" + this.host + ":" + this.port);
            this.websocket.rpc = this.rpc;

            this.websocket.onopen = () => {
                debug("Connection established");
                setTimeout(() => this.initRPC(), 200);
            };
            
            this.websocket.onerror = () => {
                debug("Connection Error");
                setTimeout(() => this.reconnect(), 100);
            };

            this.websocket.onmessage = function(evt) {
                if (typeof evt.data === 'string') {
                    debug("Incoming Message", JSON.parse(evt.data));

                } else {
                    debug("Incoming Message", typeof evt.data, evt.data);
                }

                this.rpc.messageHandler(evt.data);
            };
        }

    }

    initRPC() {
        this.rpc.toStream = (msg) => {
            try {
                debug("Sending: " + msg);
                this.websocket.send(msg);
            } catch (error) {
                debug("ERROR sending" + msg);
            }
        };

        // Setup
        this.rpc.on("microphoneStateChanged", ["isMicrophoneConnected"], (isMicrophoneConnected) => {
            this.isMicrophoneConnected = isMicrophoneConnected;
            this.getMicrophoneSettings();
            this.getMonitorMixOutputList();
        });

        this.rpc.on("microphoneSettingsChanged", 
        ["microphoneGain", "microphoneOutputVolume", "microphoneBalance", "isMicrophoneLowcutOn", "isMicrophoneClipguardOn"], 
        (microphoneGain, microphoneOutputVolume, microphoneBalance, isMicrophoneLowcutOn, isMicrophoneClipguardOn) => {
            var mic = {
                microphoneGain:             microphoneGain,
                microphoneOutputVolume:     microphoneOutputVolume,
                microphoneBalance:          microphoneBalance,
                isMicrophoneLowcutOn:       isMicrophoneLowcutOn,
                isMicrophoneClipguardOn:    isMicrophoneClipguardOn
                };
            this.micSettings = mic;
            this.emit('micSettingsChanged');
        });

        this.rpc.on("localMonitorOutputChanged", ["monitorMix"], (monitorMix) => {
            this.selectedMonitorMix = monitorMix;
            this.emit('monitorMixChanged');
        });


        this.rpc.on("monitorSwitchOutputChanged", ["switchState"], (switchState) => {
            this.switchState = switchState;
            this.emit('switchStateChanged', switchState);
        });

        this.rpc.on("outputMixerChanged", 
            ["localVolumeOut", "streamVolumeOut", "isLocalOutMuted", "isStreamOutMuted"], 
            (localVolumeOut, streamVolumeOut, isLocalOutMuted, isStreamOutMuted) => {
                this.output.localVolOut     = localVolumeOut;
                this.output.streamVolOut    = streamVolumeOut;
                this.output.isLocalMuteOut  = isLocalOutMuted;
                this.output.isStreamMuteOut = isStreamOutMuted;
                this.monitoringVolChanged();
            }
        );

        this.rpc.on("inputMixerChanged", 
            ["mixerName", "mixId", "bgColor", "isLinked", "deltaLinked", "localVolumeIn", "streamVolumeIn", "isLocalInMuted", "isStreamInMuted", "isAvailable", "filters", "localMixFilterBypass", "streamMixFilterBypass", "iconData", "inputType"], 
            (mixerName, mixerId, bgColor, isLinked, deltaLinked, localVolumeIn, streamVolumeIn, isLocalInMuted, isStreamInMuted, isAvailable, filters, localMixFilterBypass, streamMixFilterBypass, iconData, inputType) => {
                this.mixers.forEach(mixer => {
                    if (mixer.mixerId == mixerId) {
                        mixer.name                  = mixerName;
                        mixer.bgColor               = bgColor;
                        mixer.localVolIn            = localVolumeIn;
                        mixer.streamVolIn           = streamVolumeIn;

                        mixer.isLocalMuteIn         = isLocalInMuted;
                        mixer.isStreamMuteIn        = isStreamInMuted;

                        mixer.isAvailable           = isAvailable;

                        if (mixer.filters != filters) {
                            mixer.filters           = filters;
                            this.awl.updatePI();
                        }
                        
                        mixer.localMixFilterBypass  = localMixFilterBypass;
                        mixer.streamMixFilterBypass = streamMixFilterBypass;

                        mixer.iconData              = iconData;
                        mixer.inputType             = inputType;

                        this.mixerVolChanged(mixerId);     
                    }
                });
            }
        );

        this.rpc.on("channelsChanged", 
        ["channels"], 
            (channels) => {
            this.setChannels(channels);
        }
    );
        this.getApplicationInfo();
    }

    // Method for preventing spamming "volumeChanged" and updateKey() delay
    monitoringVolChanged() {
        if (!this.isKeyUpdated) {
            this.emit("outputMixerChanged");
            this.isKeyUpdated = true;
            setTimeout(() => {
                this.isKeyUpdated = false;
                this.emit("outputMixerChanged");
            }, 150);
        }
    }    

    mixerVolChanged(mixerId) {
        if (!this.isKeyUpdated) {
            this.emit("inputMixerChanged", mixerId);
            this.isKeyUpdated = true;
            setTimeout(() => {
                this.isKeyUpdated = false;
                this.emit("inputMixerChanged", mixerId);
            }, 150);
        }
    }

    setMonitorMixOutput(mixOutput) {
        this.rpc.call("setMonitorMixOutput", {"monitorMix": mixOutput }).then(
            (result) => {
                this.selectedMonitorMix = result['monitorMix'];
                this.emit('monitorMixChanged');
        })
    };

    getSwitch() {
        return this.switchState;
    }

    changeSwitchState(state) {
        this.rpc.call("switchMonitoring", {"switchState": state}).then( 
            (result) => {
                this.switchState = result["switchState"];
                this.emit("switchStateChanged");
            }
        );
    };

    adjustMicGain(vol) {
        this.micSettings.microphoneGain += vol;
        this.setMicSettings();
    }

    setMicGain(vol) {
        this.micSettings.microphoneGain = vol;
        this.setMicSettings();
    }

    adjustMicOutputVolume(vol) {
        this.micSettings.microphoneOutputVolume += vol;
        this.setMicSettings();
    }

    setMicOutputVolume(vol) {
        this.micSettings.microphoneOutputVolume = vol;
        this.setMicSettings();
    }

    adjustMicBalance(vol) {
        this.micSettings.microphoneBalance += vol;
        this.setMicSettings();
    }

    setMicBalance(vol) {
        this.micSettings.microphoneBalance = vol;
        this.setMicSettings();
    }

    setLowcut() {
        this.micSettings.isMicrophoneLowcutOn = this.micSettings.isMicrophoneLowcutOn ? false : true;
        this.setMicSettings();
    }

    setClipguard() {
        this.micSettings.isMicrophoneClipguardOn = this.micSettings.isMicrophoneClipguardOn ? false : true;
        this.setMicSettings();
    }

    setMicSettings() {
        this.rpc.call("setMicrophoneSettings", 
        {
            "microphoneGain":           this.micSettings.microphoneGain,
            "microphoneOutputVolume":   this.micSettings.microphoneOutputVolume,
            "microphoneBalance":        this.micSettings.microphoneBalance,
            "isMicrophoneLowcutOn":     this.micSettings.isMicrophoneLowcutOn,
            "isMicrophoneClipguardOn":  this.micSettings.isMicrophoneClipguardOn
            }).then((result) => {
            this.micSettings.microphoneGain             = result["microphoneGain"];
            this.micSettings.microphoneOutputVolume     = result["microphoneOutputVolume"];
            this.micSettings.microphoneBalance          = result["microphoneBalance"];
            this.micSettings.isMicrophoneLowcutOn       = result["isMicrophoneLowcutOn"];
            this.micSettings.isMicrophoneClipguardOn    = result["isMicrophoneClipguardOn"];
            this.emit("micSettingsChanged");
            });
    }

    setMute(mixerTyp, mixerId, slider) {
        const mixer = mixerTyp == "input" ? this.getMixer(mixerId) : this.output;

        const localMute = mixerTyp == "input" ? mixer.isLocalMuteIn : mixer.isLocalMuteOut;
        const streamMute = mixerTyp == "input" ? mixer.isStreamMuteIn : mixer.isStreamMuteOut;
        
        var newLocalMute, newStreamMute;

        if (slider == "all") {
            if (localMute == streamMute) 
                newLocalMute = newStreamMute = localMute ? false : true;
            else
                newLocalMute = newStreamMute = true;
        } else {
            newLocalMute = slider == "local" ? localMute ? false : true : localMute;
            newStreamMute = slider == "stream" ? streamMute ? false : true : streamMute;   
        }

        if (mixerTyp == "input") {
            mixer.isLocalMuteIn = newLocalMute;
            mixer.isStreamMuteIn = newStreamMute;
            this.setInputMixer(mixerId, slider);
        } else if (mixerTyp == "output") {
            mixer.isLocalMuteOut = newLocalMute;
            mixer.isStreamMuteOut = newStreamMute;
            this.setOutputMixer();
        }
    }

    adjustVolume(mixerTyp, mixerId, inSlider, vol) {
        // init vars based on the mixertyp
        var localVol,
            streamVol,
            slider = inSlider;

        if (mixerTyp == "input") {
            this.mixers.forEach(mixer => {
                if (mixer.mixerId == mixerId) {
                    localVol    = mixer.localVolIn;
                    streamVol   = mixer.streamVolIn;
                }  
            });
        }
        else if (mixerTyp == "output") {
            localVol = this.output.localVolOut;
            streamVol = this.output.streamVolOut;
        }

        // adjust volume based on inputtyp
        if (slider == "local") {
            localVol = localVol + vol;
        } 
        else if (slider == "stream") {
            streamVol = streamVol + vol;
        } 

        // adjust volume based on the mixertyp
        if (mixerTyp == "input") {
            this.mixers.forEach(mixer => {
                if (mixer.mixerId == mixerId) {
                    mixer.localVolIn = localVol;
                    mixer.streamVolIn = streamVol;
                    this.setInputMixer(mixerId, slider);
                }
            });
        }
        else if (mixerTyp == "output") {
            this.output.localVolOut = localVol;
            this.output.streamVolOut = streamVol;
            this.setOutputMixer();
        }
    }

    setVolume(mixerTyp, mixerId, slider, targetVol, delay) {
        var timeLeft = delay;
        var volumeSteps = 0,
        localVol,
        streamVol,
        isNotBlocked = true;

        const mixer = this.getMixer(mixerId);

        var isNotBlocked = mixerTyp == "input" ? (slider == "local" ? mixer.isNotBlockedLocal : mixer.isNotBlockedStream) : (slider == "local" ? this.output.isNotBlockedLocal : this.output.isNotBlockedStream)

        if (isNotBlocked) {
            var intervalTimer = setInterval(() => { 
                localVol = mixerTyp == "input" ? mixer.localVolIn : mixerTyp == "output" ? this.output.localVolOut : NULL;
                streamVol = mixerTyp == "input" ? mixer.streamVolIn : mixerTyp == "output" ? this.output.streamVolOut : NULL;

                if (timeLeft > 0) {
                    if (slider == "local") {
                        volumeSteps = (targetVol - localVol) / (timeLeft / this.fadingDelay);
                        localVol +=  Math.round(volumeSteps, 2);
                        mixerTyp == "input" ? mixer.isNotBlockedLocal = false : this.output.isNotBlockedLocal = false;
                    } else if (slider == "stream") {
                        volumeSteps = (targetVol - streamVol) / (timeLeft / this.fadingDelay);
                        streamVol += Math.round(volumeSteps, 2);
                        mixerTyp == "input" ? mixer.isNotBlockedStream = false  : this.output.isNotBlockedStream = false;
                    }
                    timeLeft -= this.fadingDelay;
                } else {
                    localVol = slider == "local" ? targetVol : localVol;
                    streamVol = slider == "stream" ? targetVol : streamVol;
                    
                    if (mixer) {
                        slider == "local" ? mixer.isNotBlockedLocal = true : mixer.isNotBlockedStream = true;
                    } else {
                        slider == "local" ? this.output.isNotBlockedLocal = true : this.output.isNotBlockedStream = true;
                    }   
                    clearInterval(intervalTimer);
                }

                if (localVol != null && streamVol != null) {
                    if (mixerTyp == "input") {
                        mixer.localVolIn = localVol;
                        mixer.streamVolIn = streamVol;
                        this.setInputMixer(mixerId, slider);
                    } else if (mixerTyp == "output") {
                        this.output.localVolOut = localVol;
                        this.output.streamVolOut = streamVol; 
                        this.setOutputMixer();
                    }
                }
            }, this.fadingDelay)
        } 
    }

    setFilter(mixerID, filterID) {  
        this.mixers.forEach(mixer => {
            if (mixer.mixerId == mixerID)
            {
                const filter = mixer.filters.find(f => f.filterID == filterID);
                filter.active = !filter.active;
                this.setInputMixer(mixer.mixerId, mixer.topSlider);
            }
        });
    }

    setFilterBypass(mixerID, slider) {
        const mixer = this.getMixer(mixerID);
        
        if (slider == "all") {
            if (localMute == streamMute) 
                mixer.localMixFilterBypass = mixer.streamMixFilterBypass = !mixer.localMixFilterBypass;
            else
                mixer.localMixFilterBypass = mixer.streamMixFilterBypass = true;
        } else if (slider == "local")
            mixer.localMixFilterBypass = !mixer.localMixFilterBypass;
        else if (slider == "stream")
            mixer.streamMixFilterBypass = !mixer.streamMixFilterBypass;

        this.setInputMixer(mixer.mixerId, slider);
    }
 
    setInputMixer(mixId, slider) {
        this.mixers.forEach(mixer => {
            if (mixer.mixerId == mixId) {
                this.rpc.call("setInputMixer", {
                    "mixId":                 mixer.mixerId,
                    "slider":                slider,
                    "localVolumeIn":         mixer.localVolIn,
                    "isLocalInMuted":        mixer.isLocalMuteIn,
                    "streamVolumeIn":        mixer.streamVolIn,
                    "isStreamInMuted":       mixer.isStreamMuteIn,
                    "filters":               mixer.filters,
                    "localMixFilterBypass":  mixer.localMixFilterBypass,
                    "streamMixFilterBypass": mixer.streamMixFilterBypass
                }).then((result) => {
                    mixer.isAvailable           = result["isAvailable"];
                    mixer.localVolIn            = result["localVolumeIn"];
                    mixer.isLocalMuteIn         = result["isLocalInMuted"];
                    mixer.streamVolIn           = result["streamVolumeIn"];
                    mixer.isStreamMuteIn        = result["isStreamInMuted"];
                    mixer.localMixFilterBypass  = result["localMixFilterBypass"];
                    mixer.streamMixFilterBypass = result["streamMixFilterBypass"];
                    mixer.filters               = result["filters"];                    
                    this.emit("inputMixerChanged", mixer.mixerId);
                });
            }
        });
    }

    setOutputMixer() {
        var localVol = this.output.localVolOut,
            localMute = this.output.isLocalMuteOut,
            streamVol = this.output.streamVolOut,
            streamMute = this.output.isStreamMuteOut;

        this.rpc.call("setOutputMixer", {
            "localVolumeOut": localVol,
            "isLocalOutMuted": localMute,
            "streamVolumeOut": streamVol,
            "isStreamOutMuted": streamMute
        }).then((result) => {
            this.output.localVolOut = result["localVolumeOut"];
            this.output.isLocalMuteOut  = result["isLocalOutMuted"];
            this.output.streamVolOut = result["streamVolumeOut"];
            this.output.isStreamMuteOut = result["isStreamOutMuted"];
            this.emit("outputMixerChanged");
            });
    }

    // Request
    getApplicationInfo() {
        this.rpc.call('getApplicationInfo').then((result) => {
            if (result || result == undefined) {
                if (result['appName'] == 'Elgato Wave Link') {
                    debug('Wave Link WebSocketServer found.');
                    
                    try {
                        if (this.minimumMajorRelease <= result['appVersion']['appVersionMajorRelease']) {
                            if (this.minimumMinorRelease <= result['appVersion']['appVersionMinorRelease']) {
                                if (this.minimumPatch <= result['appVersion']['appVersionPatchLevel']) {
                                    this.isWLUpToDate = true;
                                }
                            }
                        }
                        
                    } catch (e) {
                        debug('ERROR: Outdated version check.');
                        try {
                            if (this.minimumBuild <= parseInt(result['version'].match(/\((.*)\)/).pop()))
                                this.isWLUpToDate = true;

                        } catch (e) {
                            debug("ERROR: Version check failed.")
                        }
                    }                     

                    if (this.isWLUpToDate) {
                        debug("Minimum WL version or above found.");
                        this.getMicrophoneState();
                        this.getMicrophoneSettings();
                        this.getMonitorMixOutputList();
                        this.getSwitchState();
                        this.getMonitoringState();
                        this.getMixers();
                        this.isConnected = true;
                    } else {
                        debug("Please update WL-Version");
                        this.isConnected = true;
                        this.awl.updatePI();
                    }
                } else {
                    debug("Wrong WebSocketServer found.");
                }
            }
        });

        setTimeout(() => {
            if (!this.isConnected && this.isWLUpToDate) {
                this.reconnect();
            }     
        }, 200);
    }

    getMixers() {
        this.rpc.call("getAllChannelInfo").then((result) => {
            this.setChannels(result);
        });
    }

    getMicrophoneState() {
        this.rpc.call("getMicrophoneState").then(
            (result) => {
                this.isMicrophoneConnected = result["isMicrophoneConnected"];
            }
        );
    }

    getMicrophoneSettings() {
        this.rpc.call("getMicrophoneSettings").then(
            (result) => {
                var mic = {
                    microphoneGain:             result["microphoneGain"],
                    microphoneOutputVolume:     result["microphoneOutputVolume"],
                    microphoneBalance:          result["microphoneBalance"],
                    isMicrophoneLowcutOn:       result["isMicrophoneLowcutOn"],
                    isMicrophoneClipguardOn:    result["isMicrophoneClipguardOn"]
                };
                this.micSettings = mic;
                //this.emit('setKeyIcons');
            }
        );
    }

    getMonitoringState() {
        this.rpc.call("getMonitoringState").then(
            (result) => {
                this.output = {
                    localVolOut: result["localVolumeOut"],
                    streamVolOut: result["streamVolumeOut"],
                    isLocalMuteOut: result["isLocalOutMuted"],
                    isStreamMuteOut: result["isStreamOutMuted"],
                    bgColor: '#1E183C',
                    isNotBlockedLocal: true,
                    isNotBlockedStream: true
                }
                //this.emit("setKeyIcons");
            }
        );
    }

    getMonitorMixOutputList() {
        this.rpc.call("getMonitorMixOutputList").then(
            (result) => {
                this.localOutputList = Object.values(result['monitorMixList']).map(e => {
                    var out = {
                        value: e.monitorMix,
                        name: this.fixNames(e.monitorMix)
                    }

                    return out;
                });

                this.selectedMonitorMix = result['monitorMix'];
            }
        );
    }

    getSwitchState() {
        this.rpc.call("getSwitchState").then(
            (result) => {
                this.switchState = result["switchState"];
            }
        );
    }

    // Getter & Setter:

    getOutputMixer() {
        return this.output;
    }


    getMixerList() {
        return this.mixers;
    }

    setChannels(channels) {
        if (channels) {
            var i = 1;
            this.mixers = Object.values(channels).map(e => {

                switch (e.mixId) {
                    case 'pcm_in_01_c_00_sd1':
                        var icon = 'Wave';
                        break;
                    case 'pcm_out_01_v_00_sd2':
                        var icon = 'System';
                        break;
                    case 'pcm_out_01_v_02_sd3':
                        var icon = 'Music';
                        break;
                    case 'pcm_out_01_v_04_sd4':
                        var icon = 'Browser';
                        break;
                    case 'pcm_out_01_v_06_sd5':
                        var icon = 'Voice Chat';
                        break;
                    case 'pcm_out_01_v_08_sd6':
                        var icon = 'SFX';
                        break;
                    case 'pcm_out_01_v_10_sd7':
                        var icon = 'Game';
                        break;
                    case 'pcm_out_01_v_12_sd8':
                        var icon = 'AUX';
                        break;
                    case 'pcm_out_01_v_14_sd9':
                        var icon = 'AUX';
                        break;
                    default:
                        if (e.inputType == 4) {
                            var icon = 'AUX';
                        } else if (e.inputType == 1) {
                            var icon = 'Wave';
                        }
                        break;
                }
                
                var mix = {
                    channelPos: i++,
                    mixerId: e.mixId,
                    name: this.fixNames(e.mixerName),
                    inputType: e.inputType,
                    localVolIn: e.localVolumeIn,
                    streamVolIn: e.streamVolumeIn,
                    isLocalMuteIn: e.isLocalInMuted,
                    isStreamMuteIn: e.isStreamInMuted,
                    isAvailable: e.isAvailable,
                    isNotBlockedLocal: true,
                    isNotBlockedStream: true,
                    bgColor: e.bgColor,
                    icon: icon,
                    iconData: e.iconData,
                    filters: e.filters,
                    localMixFilterBypass: e.localMixFilterBypass,
                    streamMixFilterBypass: e.streamMixFilterBypass
                };
                    return mix;
                }
            );    
        }
        this.awl.updatePI();
        this.emit("setKeyIcons");
    }

    getMixer(mixerId) {
		return this.mixers.find(mixer => mixer.mixerId == mixerId);// || { isAvailable: false };
    }

    // Helper methods

    fixNames = (name, maxlen = 27, suffix = ' &hellip;') => { 
        return (name && name.length > maxlen ? name.slice(0, maxlen - 1) + suffix : name);
    };
    setConnectState(state) {
        this.isConnected = state;
    }
    setAppIsRunning(state) {
        this.appIsRunning = state;
    }

    reconnect() {
        debug("Connecting failed.");        
        if (this.port < this.endPort) {
            this.port = this.port + 1;  
        } 
        else {
            this.port = this.startPort;
        }
    this.tryToConnect();
    }

    // Taken from common.js (Control Center), adjusted to fit
    loadImage (inUrl, inCanvas, inFillcolor = '#1B0371') {

        return new Promise((resolve, reject) => {
            /** Convert to array, so we may load multiple images at once */
            const aUrl = !Array.isArray(inUrl) ? [inUrl] : inUrl;
            const canvas = inCanvas && inCanvas instanceof HTMLCanvasElement ? inCanvas : document.createElement('canvas');
            var imgCount = aUrl.length - 1;
            const imgCache = {};

            var ctx = canvas.getContext('2d');
            ctx.globalCompositeOperation = 'source-over';
        
            for (let url of aUrl) {
                let image = new Image();
                let cnt = imgCount;
                let w = 144, h = 144;
                let resize = 30;
        
                image.onload = function() {
                    imgCache[url] = this;
                    // look at the size of the second image
                    //if (url === aUrl[0]) {
                        canvas.width = w; //this.naturalWidth; // or 'width' if you want a special/scaled size
                        canvas.height = h; //this.naturalHeight; // or 'height' if you want a special/scaled size
                    //}
                    // if (Object.keys(imgCache).length == aUrl.length) {
                    if (cnt < 1) {
                        if (inFillcolor) {
                            ctx.fillStyle = inFillcolor;
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        // draw in the proper sequence FIFO
                        aUrl.forEach(e => {
                            if (!imgCache[e]) {
                                debug(imgCache[e], imgCache);
                                reject('error');
                            }
                            if (e == aUrl[0]) {
                                if (imgCache[e]) {
                                    ctx.drawImage(imgCache[e], 0 + (resize / 2), 0 +  (resize / 2), w - resize, h - resize);
                                    ctx.save();
                                }
                            } else {
                                if (imgCache[e]) {
                                    ctx.drawImage(imgCache[e], 0, 0, w, h);
                                    ctx.save();
                                }
                            }
                        });
        
                        //callback(canvas.toDataURL('image/png'));
                        var img = canvas.toDataURL('image/png');
                        resolve(img);
                        // or to get raw image data
                        // callback && callback(canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, ''));
                    }
                };
                
                imgCount--;
                image.src = url;
            }
        });
            
    };

};