/**
 * @class StreamDeck
 * StreamDeck object containing all required code to establish
 * communication with SD-Software and the Property Inspector
 */
class AppClient {
    static instance;
      
    minPort;
    maxPort;
    currentPort;
    websocket;

    rpc = new simple_jsonrpc();

    stopReconnecting = false;

    maxConnectionTries = 20;
    connectionTryCounter = 0;

    debugMode = true;

    onEvent = EventEmitter.on;
	emitEvent = EventEmitter.emit;

    on = this.rpc.on;
    call = this.rpc.call;

    constructor(minPort) {
        if (AppClient.instance)
            return AppClient.instance;

        AppClient.instance = this;

        this.setPort(minPort);
    }
    
    setPort(minPort) {
        this.debug("setPort", minPort)
        this.currentPort = minPort;
        this.minPort = minPort;
        this.maxPort = minPort + 9;
    }

    connect() {
        this.debug("connect")
        if (!this.currentPort)
            return;

        this.stopReconnecting = false;

        setTimeout(() => this.tryToConnect(), 1000);
    }

    tryToConnect() {
        this.websocket = new WebSocket('ws://127.0.0.1:' + this.currentPort);

        this.websocket.rpc = this.rpc;

        this.websocket.onopen = () => {
            this.connectionTryCounter = 0;
            this.emitEvent("webSocketIsOpen");
        };
        
        this.websocket.onerror = (evt) => {
            const error = `APP WEBOCKET ERROR: ${evt}, ${evt.data}, ${SocketErrors[evt?.code]}`;
            console.warn(error);
            setTimeout(() => this.reconnect(), 200);
        };

        this.websocket.onmessage = (evt) => {
            if (typeof evt.data === 'string') {
                this.debug("Incoming Message", JSON.parse(evt.data));
            } else {
                this.debug("Incoming Message", typeof evt.data, evt.data);
            }
            this.rpc.messageHandler(evt.data);
        };
    }

    reconnect() { 
        this.currentPort = this.currentPort < this.maxPort ? ++this.currentPort : this.minPort;
        
        if (this.connectionTryCounter < this.maxConnectionTries && !this.stopReconnecting) {
            this.connectionTryCounter++;
            this.connect();
        }
    }

    disconnect() {
        if (this.websocket) {
            this.stopReconnecting = true;
            this.websocket.close();
            this.websocket = null;
            this.emitEvent("webSocketIsClosed");
        }
    }

    initRPC() {
        this.rpc.toStream = (msg) => {
            try {
                this.debug("Sending: " + msg);
                this.websocket.send(msg);
            } catch (error) {
                this.debug("ERROR:", error);
            }
        };
    }

    onConnection(fn) {
        this.initRPC();
        this.onEvent("webSocketIsOpen", () => fn());
    }

    onDisconnection(fn) {
        this.initRPC();
        this.onEvent("webSocketIsClosed", () => fn());
    }

    debug(...args) {
        if (debugMode) console.log(...args);
    }
}