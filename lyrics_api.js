const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;

var LyricsFinder = new Lang.Class({
    Name: 'LyricsFinder',
    _init: function () {
        this.httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());

    },
    find_lyrics: function (name, artist, callback) {
        this.request = Soup.Message.new('POST', `http://music.163.com/api/search/pc?s=${name} ${artist}&type=1&limit=10`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == 200) {
                let data = JSON.parse(message.response_body.data);
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

    _init: function (song , lyrics_panel , search_menu) {
        this.parent({
            reactive: true,
            can_focus: true,
        });

        this.search_menu = search_menu;

        this.id = song.id;
        this.name = song.name;
        if(song.artists)
            this.artist = song.artists[0].name || '';
        if(song.album)  
            this.picUrl = song.album.blurPicUrl || song.album.picUrl || '';

        this.lyrics_panel = lyrics_panel;

        this.vbox = new St.BoxLayout({ vertical: false, width: 350 });
        this.actor.add_child(this.vbox);

        let icon2 = new St.Icon({
            //  gicon: Gio.icon_new_for_string(this.picUrl),
            gicon: Gio.icon_new_for_string(Me.path + "/music-symbolic.svg"),
            style: 'margin-right:10px',
            style_class: 'system-status-icon',
            icon_size: 20,
        });

        let box2 = new St.BoxLayout({ vertical: false });
        let label1 = new St.Label({ text: `${this.name} - ${this.artist}` });
        this.vbox.add_child(icon2);
        this.vbox.add_child(box2);
        box2.add(label1, { y_fill: false, y_align: St.Align.MIDDLE });

        this.httpSession = new Soup.SessionAsync();        

    },

    fetchLyrics: function(id){
        this.request = Soup.Message.new('POST', `http://music.163.com/api/song/lyric?os=pc&id=${id}&lv=1`);
        this.httpSession.queue_message(this.request, (httpSession, message) => {
            if (message.status_code == 200) {
                let data = JSON.parse(message.response_body.data);
                if (data.code == 200) {
                    if(!data.lrc){
                        this.lyrics_panel.setLyrics("-- Sorry , No lyrics --" , '');
                        return;
                    }
                    this.lyrics = this.removeTimes(data.lrc.lyric);

                    this.lyrics_panel.setLyrics(this.lyrics ,this.picUrl );
                } else {
                    this.lyrics_panel.setLyrics("Network Error" , '');
                }
            } else {
                this.lyrics_panel.setLyrics("Network Error" , '');
            }
        });
    },

    removeTimes: function(lrc){
        return lrc.replace(/^\[.*\]/gm, ' ');
    },

    activate: function (event) {
        this.fetchLyrics(this.id);
        this.search_menu.menu.close();
    }
});