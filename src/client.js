const WebSocket = require("ws"),
      events = require("events"),
      axiosRequire = require("axios").default;

class Bot {
    /**
     * Create a new Bot object
     * @param {string} appId  Application ID of the bot
     * @param {string} token  Token of the bot
     */
    constructor(appId, token) {
        this.token = token;
        this.appId = appId;
        this.ws = null; // Will be filled after login() is called
        this.events = new events.EventEmitter();
        this.axios = axiosRequire.create({
            baseURL: "https://discord.com/api/v8",
            headers: {
                authoization: `Bot ${this.token}`
            }
        });
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
            const {op, d:data, s:seq, t:event } = JSON.parse(payload);

            console.log(op);

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

            switch (op) {
                case 0: {
                    console.log(event);
                    // If the event is a slash command, event would be /<command> like /ping, otherwise the regular event name will be used
                    if (event === "INTERACTION_CREATE") {
                        this.events.emit(event, JSON.parse((data === null) ? data : "{}"));
                    } else {
                        const slashData = JSON.parse(data);
                        if (this.respond) {
                            this.axios.post(`/interactions/${slashData.interaction.id}/${slashData.interaction.token}/callback`, {
                                type: 5
                            });
                        }
                        this.events.emit(`/${slashData.data.name}`, {
                            /**
                             * Make a message response to the user. You can use either message and/or embed, you must pick one though. Leave message as "" if you wish to leave it blank.
                             * @param {string} message Plain text (markdown accepted) reply
                             * @param {string} embedData Embed reply, please see https://discord.com/developers/docs/resources/channel#embed-object for proper formatting
                             */
                            reply: function(message, embedData) {
                                this.axios.patch(`/webhooks/${this.appId}/${slashData.interaction.id}/messages/@original`);
                            },
                            data: {
                                type: slashData.type,
                                guild: slashData.guild_id,
                                channel: slashData.channel_id,
                                options: slashData.data.options
                            }
                        });
                    }
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
                    }, data.heartbeat_interval);

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
                    hb = (data == null) ? null : data.s;
                    break;
                }
            }
        });
    }
}

module.exports = Bot;