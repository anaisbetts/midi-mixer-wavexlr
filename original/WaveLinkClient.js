/// <reference path="WaveLinkConstants.js" />

// Update after interface changed
const kJSONPropertyInterfaceRevision = '2';

class WaveLinkClient extends AppClient {

    static instance;

    constructor() {
        super(1824);

        if (WaveLinkClient.instance)
            return WaveLinkClient.instance;

        WaveLinkClient.instance = this;
    }
    
    init(system) {
        debug("Init WLC...");
  
        this.UP_MAC = system == 'mac' ? true : false; 
        this.UP_WINDOWS = system == 'windows' ? true : false;

        this.maxTries = 10;
        this.counterTries = 0;

        this.isUpToDate = false;
        this.isConnected = false;

        this.awl = new AppWaveLink;

        this.event = EventEmitter;
        this.onEvent = this.event.on;
        this.emitEvent = this.event.emit;
        
        this.output = null;
        this.inputs = [];
        
        this.isMicrophoneConnected;
        this.microphones;
        this.outputs;
        this.selectedOutput;
        this.switchState;
        
        this.fadingDelay = 100;

        this.isKeyUpdated = new Map;

        this.suppressNotifications = {};
        this.suppressNotificationsTimer;

        this.localization;
        this.loadLocalization();

        this.on(kJSONPropertyMicrophoneConfigChanged, [kJSONKeyIdentifier, kJSONKeyProperty, kJSONKeyValue], (identifier, property, value) => {
            if (this.microphones?.length <= 0) {
                this.getMicrophoneConfig();
            } else {
                this.microphones.forEach( microphoneSettings => {
                    if (microphoneSettings.identifier == identifier) {
                        if (property == kJSONPropertyLowCut) {
                            if (microphoneSettings.isWaveXLR) {
                                microphoneSettings.lowCutType = value;
                            } else if (microphoneSettings.isWaveLink) {
                                microphoneSettings.isLowCutOn = value;
                            }
                            this.emitEvent(kJSONPropertyMicrophoneConfigChanged, property);
                        } else if (property == kJSONPropertyClipGuard) {
                            microphoneSettings.isClipGuardOn = value;
                            this.emitEvent(kJSONPropertyMicrophoneConfigChanged, property);
                        }
                    }
                });
            }
        });

        this.on(kJSONPropertyOutputSwitched, [kJSONKeyValue], (value) => {
            this.switchState = value;
            this.emitEvent(kJSONPropertyOutputSwitched);
        });

        this.on(kJSONPropertySelectedOutputChanged, [kJSONKeyValue], (value) => {
            this.selectedOutput = value;
            this.emitEvent(kJSONPropertySelectedOutputChanged);
        });

        this.on(kJSONPropertyOutputMuteChanged, [kJSONKeyMixerID, kJSONKeyValue], (mixerID, value) => {
            if (mixerID == kPropertyMixerIDLocal) {
                this.output.local.isMuted = value;
            } else if (mixerID == kPropertyMixerIDStream) {
                this.output.stream.isMuted = value;
            }
            this.emitEvent(kJSONPropertyOutputMuteChanged, mixerID);
        });

        this.on(kJSONPropertyOutputVolumeChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            if (this.suppressNotifications.mixerID != mixerID) {
                const updateAll = { updateAll: true };
                if (mixerID == kPropertyMixerIDLocal) {
                    this.output.local.volume = value;
                    this.throttleUpdate(identifier + mixerID, kJSONPropertyOutputVolumeChanged, { mixerID, updateAll }, 250);
                } else if (mixerID == kPropertyMixerIDStream) {
                    this.output.stream.volume = value;
                    this.throttleUpdate(identifier + mixerID, kJSONPropertyOutputVolumeChanged, { mixerID, updateAll }, 250);

                }
            }
        });

        this.on(kJSONPropertyInputsChanged, [], () => {
            this.getInputConfigs();
            this.getMicrophoneConfig();
        });

        this.on(kJSONPropertyInputMuteChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            this.inputs.forEach(input => {
                if (input.identifier == identifier) {
                    if (mixerID == kPropertyMixerIDLocal) {
                        input.local.isMuted = value;
                    } else if (mixerID == kPropertyMixerIDStream) {
                        input.stream.isMuted = value;
                    }
                    this.emitEvent(kJSONPropertyInputMuteChanged, { identifier, mixerID });
                }
            });
        });

        this.on(kJSONPropertyInputVolumeChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            if (this.suppressNotifications.identifier != identifier || (this.suppressNotifications.identifier == identifier && this.suppressNotifications.mixerID != kPropertyMixerIDAll)) {
                const updateAll = { updateAll: true };
                this.inputs.find(input => {
                    if (input.identifier == identifier) {
                        if (mixerID == kPropertyMixerIDLocal) {
                            input.local.volume = value;
                            this.throttleUpdate(identifier + mixerID, kJSONPropertyInputVolumeChanged, { identifier, mixerID, updateAll }, 250);
                        } else if (mixerID == kPropertyMixerIDStream) {
                            input.stream.volume = value;
                            this.throttleUpdate(identifier + mixerID, kJSONPropertyInputVolumeChanged, { identifier, mixerID, updateAll }, 250);
                        }
                    }
                });
            }
        });

        this.on(kJSONPropertyInputNameChanged, [kJSONKeyIdentifier, kJSONKeyValue], (identifier, value) => {
            this.inputs.forEach(input => {
                if (input.identifier == identifier) {
                    input.name = value;
                    this.emitEvent(kJSONPropertyInputNameChanged, { identifier });
                    this.emitEvent(kPropertyUpdatePI);
                }
            });
        });

        this.on(kJSONPropertyInputEnabled, [kJSONKeyIdentifier], (identifier) => {
            if (identifier.includes('PCM_IN_01_C_00_SD1')) {
                //this.getMicrophoneConfig();
            }
        });

        this.on(kJSONPropertyFilterBypassStateChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            const input = this.inputs.find(input => input.identifier == identifier);
            if (mixerID == kPropertyMixerIDLocal) {
                input.local.filterBypass = value;
            } else if (mixerID == kPropertyMixerIDStream) {
                input.stream.filterBypass = value;
            }
            this.emitEvent(kJSONPropertyFilterBypassStateChanged, { identifier, mixerID });
        });

        this.on(kJSONPropertyFilterAdded, 
            [kJSONKeyIdentifier, kJSONKeyFilterID, kJSONKeyFilterName, kJSONKeyFilterActive, kJSONKeyFilterPluginID], 
            (identifier, filterID, name, isActive, pluginID) => {
                const input = this.inputs.find(input => input.identifier == identifier);

                if (!input.filters) {
                    input.filters = [];
                }

                input.filters.push({ 
                    [kJSONKeyFilterID]: filterID,
                    [kJSONKeyFilterName]: name,
                    [kJSONKeyFilterActive]: isActive,
                    [kJSONKeyFilterPluginID]: pluginID
                });
                this.emitEvent(kPropertyUpdatePI);
            }
        );

        this.on(kJSONPropertyFilterChanged, [kJSONKeyIdentifier, kJSONKeyFilterID, kJSONKeyValue], (identifier, filterID, value) => {
            const input = this.inputs.find(input => input.identifier == identifier);
            const filter = input.filters.find(filter => filter.filterID == filterID);
            filter.isActive = value;
            this.emitEvent(kJSONPropertyFilterChanged, { identifier, filterID });
        });

        this.on(kJSONPropertyFilterRemoved, [kJSONKeyIdentifier, kJSONKeyFilterID], (identifier, filterID) => {
            const input = this.inputs.find(input => input.identifier == identifier);
            input.filters = input.filters.filter(filter => filter.filterID != filterID);    
            this.emitEvent(kPropertyUpdatePI);
        });

        this.onConnection(() => {
            this.connectWithApp();
        });

        this.onDisconnection(() => {
            this.isUpToDate = false;
            this.isConnected = false;

            this.emitEvent(kPropertyUpdatePI);
            this.emitEvent(kPropertyOutputChanged);
            this.emitEvent(kJSONPropertyInputsChanged);
        });
    }

    async connectWithApp() {
        if (!this.isConnected && this.counterTries < this.maxTries) {
            this.getApplicationInfo();
            this.counterTries++;
            await new Promise(resolve => _setTimeoutESD(resolve, 1500));
            this.connectWithApp();
        } else {
            this.counterTries = 0;
        }
    }

    async loadLocalization() {
        await $SD.loadLocalization('');
        
        this.localization = $SD.localization['Actions'];
    }

    getApplicationInfo() {
        this.call(kJSONPropertyGetApplicationInfo).then((result) => {
            if (result || result == undefined) {                
                if (result[kJSONKeyInterfaceRevision] >= kJSONPropertyInterfaceRevision) {
                    debug(`Minimum ${kJSONPropertyAppName} interface revision or above found.`);
                    debug(`Minumum interface revision for ${kJSONPropertyAppName} found: Current: ${result[kJSONKeyInterfaceRevision]}, Minimum: ${kJSONPropertyInterfaceRevision}`);
                    this.setConnectionState(true);
                    this.isUpToDate = true;
                    this.getMicrophoneConfig();
                    this.getSwitchState();
                    this.getOutputConfig();
                    this.getOutputs();
                    this.getInputConfigs();
                    this.emitEvent(kPropertyUpdatePI);
                    this.emitEvent(kPropertyOutputChanged);
                } else {
                    this.setConnectionState(true);
                    this.isUpToDate = false;
                    debug(`Wrong interface revision for ${kJSONPropertyAppName}: Current ${result[kJSONKeyInterfaceRevision]}, Minimum: ${kJSONPropertyInterfaceRevision}`);
                    this.emitEvent(kPropertyUpdatePI);
                    this.emitEvent(kPropertyOutputChanged);
                    this.emitEvent(kJSONPropertyInputsChanged);
                }        
            }
        });
    }

    getMicrophoneConfig() {
        this.rpc.call(kJSONPropertyGetMicrophoneConfig).then((result) => {
            if (result) {
                this.microphones = result; 
                this.emitEvent(kJSONPropertyGetMicrophoneConfig);
            }
        });
    }

    setMicrophoneConfig(property, isAdjustVolume, value = 0) {
        this.checkAppState();

        if (this.microphones?.length <= 0)
            throw `No device available`

        var idx = 0;
        this.microphones.forEach( microphoneSettings => {
            if (idx != 0)
                return;
           
            this.rpc.call(kJSONPropertySetMicrophoneConfig, {
                [kJSONKeyIdentifier]: microphoneSettings.identifier,
                [kJSONKeyProperty]: property,
                [kJSONKeyIsAdjustVolume]: isAdjustVolume,
                [kJSONKeyValue]: value
            });
            idx++;
        });  
    }

    getSwitchState() {
        this.rpc.call(kJSONPropertyGetSwitchState).then(
            (result) => {
                this.switchState = result[kJSONKeyValue];
                this.emitEvent(kJSONPropertyOutputSwitched);
            }
        );
    }

    changeSwitchState() {
        this.checkAppState();

        this.rpc.call(kJSONPropertySwitchOutput, {});
    };

    getOutputs() {
        this.rpc.call(kJSONPropertyGetOutputs).then(
            (result) => {
                this.outputs = result[kJSONKeyOutputs];
                this.selectedOutput = result[kJSONKeySelectedOutput];

                this.emitEvent(kJSONPropertySelectedOutputChanged);
            }
        );
    }

    setSelectedOutput(identifier) {
        this.checkAppState();
        
        const name = this.outputs.find( output => output.identifier == identifier)?.name;

        this.rpc.call(kJSONPropertySetSelectedOutput, {
            [kJSONKeyIdentifier]: identifier,
            [kJSONKeyName]: name
        });
    }

    getOutputConfig() {
        this.rpc.call(kJSONPropertyGetOutputConfig).then(
            (result) => {
                this.output = {
                    local: {
                        isMuted: result[kJSONKeyLocalMixer][0],
                        volume: result[kJSONKeyLocalMixer][1]
                    },
                    stream: {
                        isMuted: result[kJSONKeyStreamMixer][0],
                        volume: result[kJSONKeyStreamMixer][1]
                    },
                    [kJSONKeyBgColor]: '#1E183C',
                    isNotBlockedLocal: true,
                    isNotBlockedStream: true
                }
                this.emitEvent(kPropertyOutputChanged);
                this.emitEvent(kPropertyUpdatePI);
            }
        );
    }
 
    setOutputConfig(context, property, isAdjustVolume, mixerID, value, fadingTime) {
        this.checkAppState();

        const output = this.getOutput();
        const updateAll = { updateAll: true } 

        if (output && fadingTime) {
            const isAlreadyFading = mixerID == kPropertyMixerIDLocal ? !output.isNotBlockedLocal : !output.isNotBlockedStream;

            if (isAlreadyFading) {
                return;
            }

            var timeLeft = fadingTime;
            var newValue = 0;

            const intervalTimer = setInterval(() => {
                if (timeLeft > 0) {
                    const currentValue = mixerID == kPropertyMixerIDLocal ? output.local.volume : output.stream.volume;

                    const volumeSteps = (value - currentValue) / (timeLeft / this.fadingDelay);
                    newValue = currentValue +  Math.round(volumeSteps, 2);
                    mixerID == kPropertyMixerIDLocal ? output.isNotBlockedLocal = false : output.isNotBlockedStream = false;
                   
                    timeLeft -= this.fadingDelay;
                } else {
                    mixerID == kPropertyMixerIDLocal ? output.isNotBlockedLocal = true : output.isNotBlockedStream = true;
                    clearInterval(intervalTimer);
                }

                this.suppressNotifications.mixerID = mixerID;
    
                if (this.suppressNotificationsTimer) {
                    clearTimeout(this.suppressNotificationsTimer);
                }
                this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.mixerID = ''; }, 250);
                this.throttleUpdate(context, kJSONPropertyOutputVolumeChanged, { context, mixerID, updateAll }, 100);
    
                this.rpc.call(kJSONPropertySetOutputConfig, {
                    [kJSONKeyProperty]: property,
                    [kJSONKeyMixerID]: mixerID,
                    [kJSONKeyValue]: newValue,
                    [kJSONKeyForceLink]: false
                });
                
            }, this.fadingDelay)
        } else {
            const forceLink = mixerID == kPropertyMixerIDAll;
            var newValue = 0; 
            var newMixerID = mixerID;

            if (isAdjustVolume) {
                if (forceLink) {
                    if (value < 0) {
                        newMixerID = output.local.volume > output.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                    } else {
                        newMixerID = output.local.volume < output.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                    }

                    output.local.volume = output.local.volume + value < 0 ? 0 : output.local.volume + value > 100 ? 100 : output.local.volume + value;
                    output.stream.volume = output.stream.volume + value < 0 ? 0 : output.stream.volume + value > 100 ? 100 : output.stream.volume + value;

                    newValue = newMixerID == kPropertyMixerIDLocal ? output.local.volume : output.stream.volume;
                } else {
                newValue = newMixerID == kPropertyMixerIDLocal ? output.local.volume + value : output.stream.volume + value;

                newValue = newValue < 0 ? 0 : newValue > 100 ? 100 : newValue;

                newMixerID == kPropertyMixerIDLocal ? output.local.volume = newValue : output.stream.volume = newValue;
                }
            } else {
                newValue = value;
            }

            this.suppressNotifications.mixerID = newMixerID;

            if (this.suppressNotificationsTimer) {
                clearTimeout(this.suppressNotificationsTimer);
            }
            this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.mixerID = ''; }, 250);
            this.throttleUpdate(context, kJSONPropertyOutputVolumeChanged, { context, mixerID, updateAll }, 100);

            this.rpc.call(kJSONPropertySetOutputConfig, {
                [kJSONKeyProperty]: property,
                [kJSONKeyMixerID]: newMixerID,
                [kJSONKeyValue]: newValue,
                [kJSONKeyForceLink]: forceLink
            });
        }
    }

    getInputConfigs() {
        this.rpc.call(kJSONPropertyGetInputConfigs).then((result) => {
            this.inputs = [];
            result.forEach(input => {
                this.inputs.push({
                    [kJSONKeyIdentifier]:   input[kJSONKeyIdentifier],
                    [kJSONKeyName]:         input[kJSONKeyName],
                    [kJSONKeyInputType]:    input[kJSONKeyInputType],
                    [kJSONKeyIsAvailable]:  input[kJSONKeyIsAvailable],
                    [kJSONKeyBgColor]:      input[kJSONKeyBgColor],
                    [kJSONKeyIconData]:     input[kJSONKeyIconData],
                    [kJSONKeyFilters]:      input[kJSONKeyFilters], 

                    local: {
                        isMuted: input[kJSONKeyLocalMixer][0],
                        volume: input[kJSONKeyLocalMixer][1],
                        filterBypass: input[kJSONKeyLocalMixer][2]
                    },
                    stream: {
                        isMuted: input[kJSONKeyStreamMixer][0],
                        volume: input[kJSONKeyStreamMixer][1],
                        filterBypass: input[kJSONKeyStreamMixer][2]
                    },

                    isNotBlockedLocal:  true,
                    isNotBlockedStream: true
                });
                
                if (input.iconData) {
                    const macIcon = '<image id="appIcon" width="144" height="144" x="0" y="0" xlink:href="data:image/png;base64,' + input.iconData + '"/>';

                    this.awl.keyIconsInput[`${input.name}`]     = new SVGIconWL({ icons: `./images/key/inputActions/default.svg`, icon: `default`});
                    this.awl.keyIconsInput[`${input.name}Mute`] = new SVGIconWL({ icons: `./images/key/inputActions/default.svg`, icon: `default`});
                    this.awl.keyIconsInput[`${input.name}Set`]  = new SVGIconWL({ icons: `./images/key/inputActions/default.svg`, icon: `default`});
                    this.awl.keyIconsInput[`${input.name}`].layers.macAppIcon     = macIcon;
                    this.awl.keyIconsInput[`${input.name}Mute`].layers.macAppIcon = macIcon;
                    this.awl.keyIconsInput[`${input.name}Set`].layers.macAppIcon  = macIcon;
                }
            });

            this.emitEvent(kJSONPropertyInputsChanged);
            this.emitEvent(kPropertyUpdatePI);
        });
    }

    setInputConfig(context, property, isAdjustVolume, identifier, mixerID, value, fadingTime) {
        this.checkAppState();

        const input = this.getInput(identifier);
        const updateAll = { updateAll: true } 

        if (input && fadingTime) {
            const isAlreadyFading = mixerID == kPropertyMixerIDLocal ? !input.isNotBlockedLocal : !input.isNotBlockedStream;

            if (isAlreadyFading) {
                return;
            }

            var timeLeft = fadingTime;
            var newValue = 0;

            const intervalTimer = setInterval(() => {
                if (timeLeft > 0) {
                    const currentValue = mixerID == kPropertyMixerIDLocal ? input.local.volume : input.stream.volume;
                    const volumeSteps = (value - currentValue) / (timeLeft / this.fadingDelay);
                    
                    newValue = currentValue +  Math.round(volumeSteps, 2);
                    mixerID == kPropertyMixerIDLocal ? input.isNotBlockedLocal = false : input.isNotBlockedStream = false;

                    timeLeft -= this.fadingDelay;

                    mixerID == kPropertyMixerIDLocal ? input.local.volume = newValue : input.stream.volume = newValue;
                } else {
                    mixerID == kPropertyMixerIDLocal ? input.isNotBlockedLocal = true : input.isNotBlockedStream = true;
                    clearInterval(intervalTimer);
                }

                this.suppressNotifications.identifier = identifier;
                this.suppressNotifications.mixerID = mixerID;
    
                if (this.suppressNotificationsTimer) {
                    clearTimeout(this.suppressNotificationsTimer);
                }
                
                this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.identifier = ''; this.suppressNotifications.mixerID = ''; }, 250);
                this.throttleUpdate(context, kJSONPropertyInputVolumeChanged, { context, identifier, mixerID, updateAll }, 100);
    
                this.rpc.call(kJSONPropertySetInputConfig, {
                    [kJSONKeyProperty]: property,
                    [kJSONKeyIdentifier]: identifier,
                    [kJSONKeyMixerID]: mixerID,
                    [kJSONKeyValue]: newValue,
                    [kJSONKeyForceLink]: false
                });
                
            }, this.fadingDelay)
        } else {
            const forceLink = mixerID == kPropertyMixerIDAll;
            var newValue = 0;
            var newMixerID = mixerID;

            if (isAdjustVolume) {
                if (forceLink) {
                    if (value < 0) {
                        newMixerID = input.local.volume > input.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                    } else {
                        newMixerID = input.local.volume < input.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                    }

                    input.local.volume = input.local.volume + value < 0 ? 0 : input.local.volume + value > 100 ? 100 : input.local.volume + value;
                    input.stream.volume = input.stream.volume + value < 0 ? 0 : input.stream.volume + value > 100 ? 100 : input.stream.volume + value;

                    newValue = newMixerID == kPropertyMixerIDLocal ? input.local.volume : input.stream.volume;
                } else {
                    newValue = newMixerID == kPropertyMixerIDLocal ? input.local.volume + value : input.stream.volume + value;

                    newValue = newValue < 0 ? 0 : newValue > 100 ? 100 : newValue;
    
                    newMixerID == kPropertyMixerIDLocal ? input.local.volume = newValue : input.stream.volume = newValue;
                }
            } else {
                newValue = value;
            }

            this.suppressNotifications.identifier = identifier;
            this.suppressNotifications.mixerID = mixerID;

            if (this.suppressNotificationsTimer) {
                clearTimeout(this.suppressNotificationsTimer);
            }
            
            this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.identifier = ''; this.suppressNotifications.mixerID = ''; }, 250);
            this.throttleUpdate(context, kJSONPropertyInputVolumeChanged, { context, identifier, mixerID, updateAll }, 100);

            this.rpc.call(kJSONPropertySetInputConfig, {
                [kJSONKeyProperty]: property,
                [kJSONKeyIdentifier]: identifier,
                [kJSONKeyMixerID]: newMixerID,
                [kJSONKeyValue]: newValue,
                [kJSONKeyForceLink]: forceLink
            });
        }
    }

    setFilterBypass(identifier, mixerID, value) {
        this.checkAppState();

        this.rpc.call(kJSONPropertySetFilterBypass, {
            [kJSONKeyIdentifier]: identifier,
            [kJSONKeyMixerID]: mixerID,
            [kJSONKeyValue]: value
        });
    }

    setFilterConfig(identifier, filterID, value) {
        this.checkAppState();

        this.rpc.call(kJSONPropertySetFilter, {
            [kJSONKeyIdentifier]: identifier,
            [kJSONKeyFilterID]: filterID,
            [kJSONKeyValue]: value
        });
    }

    // Getter & Setter:
    getOutput() {
        return this.output;
    }

    getInput(identifier) {
		return this.inputs.find(input => input.identifier == identifier);
    }

    // Helper methods
    throttleUpdate(context, event, payload, time) {
        if (!this.isKeyUpdated.get(context)) {
            this.isKeyUpdated.set(context, true);
            _setTimeoutESD(() => {
                this.emitEvent(event, payload);
                this.isKeyUpdated.delete(context);
            }, time);
        }  
    }

    fixNames = (name, maxlen = 27, suffix = ' &hellip;') => { 
        return (name && name.length > maxlen ? name.slice(0, maxlen - 1) + suffix : name);
    };

    setConnectionState(state) {
        this.isConnected = state;
        this.emitEvent(kPropertyUpdatePI);
    }

    setAppIsRunning(state) {
        this.appIsRunning = state;
    }

    isAppStateOk() {
        return this.isConnected && this.isUpToDate;
    }

    checkAppState() {
        if (!this.isConnected || !this.isUpToDate) {
            throw 'App not connected or update needed'
        }
    }
};