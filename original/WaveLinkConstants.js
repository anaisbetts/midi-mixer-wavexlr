// Request
// Common
const kJSONPropertyGetApplicationInfo       = 'getApplicationInfo';

// Microphone
const kJSONPropertyGetMicrophoneConfig      = 'getMicrophoneConfig';
const kJSONPropertySetMicrophoneConfig      = 'setMicrophoneConfig';

// Output
const kJSONPropertyGetSwitchState           = 'getSwitchState';
const kJSONPropertySwitchOutput             = "switchOutput";
const kJSONPropertyGetOutputConfig          = 'getOutputConfig';
const kJSONPropertySetOutputConfig          = 'setOutputConfig';
const kJSONPropertyGetOutputs               = 'getOutputs';
const kJSONPropertySetSelectedOutput        = 'setSelectedOutput';

// Input
const kJSONPropertyGetInputConfigs          = 'getInputConfigs';
const kJSONPropertySetInputConfig           = 'setInputConfig';
const kJSONPropertySetFilterBypass          = 'setFilterBypass';
const kJSONPropertySetFilter                = 'setFilter';

// Notifications
const kPropertyUpdatePI                     = 'updatePI';
const kPropertyOutputChanged                = 'outputChanged';

// Microphone
const kJSONPropertyMicrophoneConfigChanged  = "microphoneConfigChanged";

// Output
const kJSONPropertyOutputSwitched           = "outputSwitched";
const kJSONPropertySelectedOutputChanged    = "selectedOutputChanged";
const kJSONPropertyOutputMuteChanged        = "outputMuteChanged";
const kJSONPropertyOutputVolumeChanged      = "outputVolumeChanged";

// Input
const kJSONPropertyInputNameChanged         = "inputNameChanged";
const kJSONPropertyInputMuteChanged         = "inputMuteChanged";
const kJSONPropertyInputVolumeChanged       = "inputVolumeChanged";
const kJSONPropertyInputEnabled             = "inputEnabled";
const kJSONPropertyInputDisabled            = "inputDisabled";
const kJSONPropertyFilterBypassStateChanged = "filterBypassStateChanged";
const kJSONPropertyFilterChanged            = 'filterChanged';
const kJSONPropertyFilterAdded              = 'filterAdded';
const kJSONPropertyFilterRemoved            = 'filterRemoved';
const kJSONPropertyInputsChanged            = 'inputsChanged';

// Keys / Properties
// Common
const kJSONKeyIdentifier                    = 'identifier';
const kJSONKeyName                          = 'name';
const kJSONKeyProperty                      = 'property';
const kJSONKeyValue                         = 'value';
const kJSONKeyIsAdjustVolume                = 'isAdjustVolume';
const kJSONKeyMixerID                       = 'mixerID';
const kJSONKeyLocalMixer                    = "localMixer";
const kJSONKeyStreamMixer                   = "streamMixer";

// Wave Link / Plugin
const kPropertyVolume                       = "Volume";
const kPropertyMute                         = "Mute";

const kPropertyOutputLevel	                = "Output Level";
const kPropertyOutputMute	                = "Output Mute";

const kPropertyMixerIDLocal                 = "com.elgato.mix.local";
const kPropertyMixerIDStream                = "com.elgato.mix.stream";
const kPropertyMixerIDAll                   = "com.elgato.mix.all";

const kJSONKeyForceLink                     = "forceLink";

// Application Info
const kJSONKeyAppID                         = 'appID';
const kJSONKeyAppName                       = 'appName';
const kJSONKeyInterfaceRevision             = 'interfaceRevision';

const kJSONPropertyAppID                    = 'egwl';
const kJSONPropertyAppName                  = 'Elgato Wave Link';

// Microphone
const kJSONKeyIsWaveLink					= "isWaveLink";
const kJSONKeyIsWaveXLR					    = "isWaveXLR";
const kJSONPropertyGain                     = "gain";
const kJSONPropertyOutputVolume             = "outputVolume";
const kJSONPropertyBalance                  = "balance";
const kJSONPropertyLowCut                   = "lowCut";
const kJSONKeyLowCutType                    = "lowCutType";
const kJSONPropertyClipGuard                = "clipGuard";

// Output
const kJSONKeySelectedOutput                = 'selectedOutput';
const kJSONKeyOutputs                       = 'outputs';

// Input
const kJSONKeyInputType                     = 'inputType';
const kJSONKeyIconData                      = 'iconData';
const kJSONKeyBgColor                       = 'bgColor';
const kJSONKeyIsAvailable                   = 'isAvailable';
const kJSONKeyFilters                       = 'filters';
const kJSONKeyFilterID                      = 'filterID';
const kJSONKeyFilterName                    = 'name';
const kJSONKeyFilterActive                  = 'isActive';
const kJSONKeyFilterPluginID                = 'pluginID';

// Plugin
const kPropertyDefault                      = 'default';
const kPropertyWarning                      = 'warning';


const ActionType = {
    Mute: 0,
    SetVolume: 1,
    AdjustVolume: 2,
    SetEffect: 3,
    SetEffectChain: 4,
    SetDeviceSettings: 5,
    SetOutput: 6,
    ToggleOutput: 7,
    SwitchOutput: 8
}