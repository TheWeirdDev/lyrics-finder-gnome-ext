const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const {Soup, St, Gio, GObject, Clutter}  = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;
const settings = Convenience.getSettings();

var LyricsFinder = class LyricsFinder {

    constructor() {
        this.httpSession = new Soup.Session();
        this.httpSession.add_feature(new Soup.ProxyResolverDefault());
        this.httpSession.timeout = 10;
        this.request = null;
    }

    cancel_last_search() {
        if (this.request != null) {
            this.httpSession.cancel_message(this.request, Soup.Status.CANCELLED);
        }
    }

    find_lyrics(title, artist, callback) {
        const limit = settings.get_int(Keys.SEARCH_LIMIT);
        // Cancel the ongoing message
        this.cancel_last_search();
        this.request = Soup.Message.new('POST', `http://music.163.com/api/search/pc?s=${encodeURI(title + ' '+ artist)}&type=1&limit=${limit}`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == Soup.Status.CANCELLED)
                return;
            if (message.status_code == 200) {
                const data = JSON.parse(message.response_body.data);
                if (data.code == 200 && data.result.songCount >= 1) {
                    callback(Array.from(data.result.songs));
                } else {
                    callback([]);
                }
            } else {
                callback([]);
            }
        });
    }
}


var LyricsItem = GObject.registerClass(class Lyrics_Item extends PopupMenu.PopupBaseMenuItem {

    _init(song, lyrics_panel, search_menu, storage_manager, title, artist) {
        super._init({
            reactive: true,
            can_focus: true,
        });
        this._title = title;
        this._artist = artist;

        this.storage_manager = storage_manager;

        this.search_menu = search_menu;

        this.id = song.id;
        this.name = song.name;
        if (song.artists)
            this.artist = song.artists[0].name || '';
        if (song.album)
            this.picUrl = song.album.blurPicUrl || song.album.picUrl || '';

        this.lyrics_panel = lyrics_panel;

        this.vbox = new St.BoxLayout({ vertical: false, width: 300 });
        this.actor.add_child(this.vbox);

        const icon2 = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + "/music-symbolic.svg"),
            style: 'margin-right:10px',
            style_class: 'system-status-icon',
            icon_size: 20,
        });

        const box2 = new St.BoxLayout({ vertical: false });
        const label1 = new St.Label({
            text: `${this.name} - ${this.artist}`,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.vbox.add_child(icon2);
        this.vbox.add_child(box2);
        box2.add_child(label1);

        this.httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());

    }

    fetchLyrics(id) {
        this.request = Soup.Message.new('POST', `http://music.163.com/api/song/lyric?os=pc&id=${id}&lv=1`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == 200) {
                const data = JSON.parse(message.response_body.data);
                if (data.code == 200) {
                    if (!data.lrc) {
                        this.lyrics_panel.setLyrics("-- Empty response --", '');
                        return;
                    }
                    this.lyrics = this.removeTimes(data.lrc.lyric);

                    this.lyrics_panel.setLyrics(this.lyrics, this.picUrl);
                    if (settings.get_boolean(Keys.SAVE_LYRICS)) {
                        this.storage_manager.save(this._title, this._artist, this.lyrics, this.picUrl);
                    }
                } else {
                    this.lyrics_panel.setLyrics("Network Error", '');
                }
            } else {
                this.lyrics_panel.setLyrics("Network Error", '');
            }
        });
    }

    removeTimes(lrc) {
        return lrc.replace(/^\s*\[.*\]\s*/gm, '');
    }

    activate(event) {
        if (this.search_menu) {
            this.fetchLyrics(this.id);
            this.search_menu.menu.close();
        }
    }
});
