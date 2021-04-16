const Me = imports.misc.extensionUtils.getCurrentExtension();
const DBusIface = Me.imports.dbus;
const MediaInfo = Me.imports.media_info;

var PlayerManager = class Player_Manager {

    constructor(callback) {
        this._dbus = new DBusIface.DBus();

        this.players = {};
        this._callback = callback;

        // player DBus name pattern
        const name_regex = /^org\.mpris\.MediaPlayer2\./;

        this._dbus.ListNamesRemote((names) => {
            const playerNames = [];
            for (let name of names[0]) {
                if (name_regex.test(name)) {
                    playerNames.push(name);
                }
            }
            playerNames.sort();
            for (let player of playerNames) {
                this._dbus.GetNameOwnerRemote(player, (owner) => {
                    this.add_player(player, owner);
                });
            }
        });

        this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
            (proxy, sender, [name, old_owner, new_owner]) => {
                if (name_regex.test(name)) {
                    // if (!this._disabling) {
                    if (new_owner && !old_owner) {
                        // this._addPlayer(name, new_owner);
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
        );
    }

    add_player(name, owner) {
        this.players[owner] = new MediaInfo.MediaInfo(name, owner, this._callback);
    }

    remove_player(name, owner) {
        try {
            this.players[owner].disconnect();
            delete this.players[owner];
        }catch(e){
        }
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
        }
    }

}
