const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;
const settings = Convenience.getSettings();

var LyricsFinder = new Lang.Class({
    Name: 'LyricsFinder',
    _init: function () {
        this.httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());

    },
    find_lyrics: function (title, artist, callback) {
        const limit = settings.get_int(Keys.SEARCH_LIMIT);
        this.request = Soup.Message.new('POST', `http://music.163.com/api/search/pc?s=${title} ${artist}&type=1&limit=${limit}`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == 200) {
                const data = JSON.parse(message.response_body.data);
                if (data.code == 200) {
                    if (data.result.songCount < 1)
                        callback([]);
                    else
                        callback(Array.from(data.result.songs));
                } else {
                    callback([]);
                }
            } else {
                callback([]);
            }
        });
    }
});


var LyricsItem = new Lang.Class({
    Name: 'LyricsItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (song, lyrics_panel, search_menu, storage_manager, title, artist) {
        this.parent({
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
        const label1 = new St.Label({ text: `${this.name} - ${this.artist}` });
        this.vbox.add_child(icon2);
        this.vbox.add_child(box2);
        box2.add(label1, { y_fill: false, y_align: St.Align.MIDDLE });

        this.httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());     

    },

    fetchLyrics: function (id) {
        this.request = Soup.Message.new('POST', `http://music.163.com/api/song/lyric?os=pc&id=${id}&lv=1`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == 200) {
                const data = JSON.parse(message.response_body.data);
                if (data.code == 200) {
                    if (!data.lrc) {
                        this.lyrics_panel.setLyrics("-- Sorry , No lyrics --", '');
                        return;
                    }
                    this.lyrics = this.removeTimes(data.lrc.lyric);

                    this.lyrics_panel.setLyrics(this.lyrics, this.picUrl);
                    this.storage_manager.save(this._title, this._artist, this.lyrics, this.picUrl);
                } else {
                    this.lyrics_panel.setLyrics("Network Error", '');
                }
            } else {
                this.lyrics_panel.setLyrics("Network Error", '');
            }
        });
    },

    removeTimes: function (lrc) {
        return lrc.replace(/^\[.*\]/gm, ' ');
    },

    activate: function (event) {
        if (this.search_menu) {
            this.fetchLyrics(this.id);
            this.search_menu.menu.close();
        }
    }
});