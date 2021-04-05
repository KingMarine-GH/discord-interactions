const WebSocket = require("ws");

class Bot {
    /**
     * Create a new Bot object
     * @param {string} token  Token of the bot
     */
    constructor(token) {
        this.token = token;
        this.ws = null; // Will be filled after login() is called
    }

    /**
     * Login the bot into the gateway
     */
    async login() {
        this.ws = new WebSocket("wss://gateway.discord.gg/?v=6&encoding=json");
        this.ws.on("open", () => {
            console.log("WebSocket Connection Open!");
        });

        let ack, hb, heartbeat;
        this.ws.on("message", payload => {
            const data = JSON.parse(payload);

            console.log(data.op);

            const beat = () => {
                if (ack === false) {
                    clearInterval(heartbeat);
                    this.ws.close(0);
                    console.error("Gateway didn't ACK heartbeat, reconnecting!");
                    this.login();
                    return;
                }

                const number = (typeof hb == Number) ? hb : null;
                            
                this.ws.send(JSON.stringify({
                    op: 1,
                    d: number
                }));

                console.log("Heartbeated");
            };

            switch (data.op) {
                case 0: {
                    
                    break;
                }
                case 1: {
                    beat();
                    ack = false;
                    break;
                }
                case 10: {
                    ack = true; // work around for the first heartbeat

                    beat(); // first beat
                    heartbeat = setInterval(() => {
                        beat();
                        ack = false;
                    }, data.d.heartbeat_interval);

                    // identify
                    this.ws.send(JSON.stringify({
                        op: 2,
                        d: {
                            token: this.token,
                            intents: 0, // TODO get intents
                            properties: {
                                $os: "windows",
                                $browser: "@kingmarine/discord-interactions",
                                $device: "@kingmarine/discord-interactions"
                            }
                        }
                    }));
                    break;
                }
                case 11: {
                    ack = true;
                    hb = (data.d == null) ? null : data.d.s;
                    break;
                }
            }
        });
    }
}

module.exports = Bot;