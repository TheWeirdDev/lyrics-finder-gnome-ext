const Me = imports.misc.extensionUtils.getCurrentExtension();
const DBusIface = Me.imports.dbus;
const Lang = imports.lang;

var MediaInfo = class Media_Info {

    constructor(busName, owner, callback) {
        this.owner = owner;

        new DBusIface.Properties(busName,
            Lang.bind(this, function (proxy) {
                this._prop = proxy;
                this._ready();
            }));

        new DBusIface.MediaServer2Player(busName,
            Lang.bind(this, function (proxy) {
                this._mediaServerPlayer = proxy;
                this._server_ready();
            }));

        this._callback = callback;
    }

    _ready() {
        this._propChangedId = this._prop.connectSignal('PropertiesChanged', Lang.bind(this, function (proxy, sender, [iface, props]) {
            if (!props.Metadata)
                return;

            this.parse_data(props.Metadata.deep_unpack());
        }));
    }

    _server_ready(){
        this.parse_data(this._mediaServerPlayer.Metadata);
    }

    parse_data(metadata) {
        if (!metadata || Object.keys(metadata).length < 2) {
            metadata = {};
        }

        const title = metadata["xesam:title"] ? metadata["xesam:title"].unpack() : "";

        let trackArtist = metadata["xesam:artist"] ? metadata["xesam:artist"].deep_unpack().toString() : "";
        trackArtist = metadata["rhythmbox:streamTitle"] ? metadata["rhythmbox:streamTitle"].unpack() : trackArtist;
        if (title.trim().length == 0){
            this._callback();
            return;
        }

        const txt = `${title} : ${trackArtist}`;
        this._callback(title,trackArtist);
    }

    disconnect() {
        this._prop.disconnectSignal(this._propChangedId);
        this._callback();
    }
}
