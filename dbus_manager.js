const Me = imports.misc.extensionUtils.getCurrentExtension();
const DBusIface = Me.imports.dbus;
const Lang = imports.lang;
const MediaInfo = Me.imports.media_info;

var PlayerManager = class Player_Manager {

    constructor(callback) {
        this._dbus = new DBusIface.DBus();

        this.players = {};
        this._callback = callback;

        // player DBus name pattern
        const name_regex = /^org\.mpris\.MediaPlayer2\./;

        this._dbus.ListNamesRemote(Lang.bind(this, function (names) {
            const playerNames = [];
            for (let n in names[0]) {
                const name = names[0][n];
                if (name_regex.test(name)) {
                    playerNames.push(name);
                }
            }
            playerNames.sort();
            for (let i in playerNames) {
                const player = playerNames[i];
                this._dbus.GetNameOwnerRemote(player, Lang.bind(this, (owner) => {
                    this.add_player(player, owner);
                }));
            }
        }));

        this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged', Lang.bind(this,
            function (proxy, sender, [name, old_owner, new_owner]) {
                if (name_regex.test(name)) {
                    // if (!this._disabling) {
                    if (new_owner && !old_owner) {
                        // this._addPlayer(name, new_owner);
                        global.log('LyricsFinder: ', name, new_owner);
                        this.add_player(name, new_owner);
                    }
                    else if (old_owner && !new_owner) {
                        this.remove_player(name, old_owner);
                    }
                    else {
                        this.change_player_owner(name, old_owner, new_owner);
                    }
                }
                // }
            }
        ));
    }

    add_player(name, owner) {
        this.players[owner] = new MediaInfo.MediaInfo(name, owner, this._callback);
    }

    remove_player(name, owner) {
        this.players[owner].disconnect();
        delete this.players[owner];
    }

    change_player_owner(name, old_owner, new_owner) {
        this.remove_player(name, old_owner);
        this.add_player(name, new_owner);
    }

    disconnect_all() {
        try {
            for (let owner in this.players) {
                this.remove_player(this.players[owner], owner);
            }
            this._dbus.disconnectSignal(this._ownerChangedId);
        }catch(e){
            global.log(e,"Error disconnecting player");
        }
    }

}
