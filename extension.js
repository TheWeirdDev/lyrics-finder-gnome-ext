const Animation = imports.ui.animation;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const Manager = Me.imports.dbus_manager;
const Lyrics = Me.imports.lyrics_api;
const Storage = Me.imports.storage;

const LyricsPanel = new Lang.Class({
    Name: 'Popup',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent({
            hover: false,
            activate: false,
            can_focus: true,
        });
        this.lyrics = '... No lyrics ...';

        this.label = new St.Label({ text: this.lyrics, style: 'padding:5px;text-align:center;font-size:1.2em;' });
        this.label.clutter_text.line_wrap = true;
        this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.box = new St.BoxLayout({
            vertical: true,
            width: 350,
            style: 'spacing: 5px;'
        });
        this.imgbox = new St.BoxLayout({
            vertical: true,
            style: 'margin-bottom: 10px;'
        });
        this.icon = new St.Icon({
            icon_size: 130,
        });
        this.scrollView = new St.ScrollView();
        this.scrollView._delegate = this;
        this.scrollView.clip_to_allocation = true;

        this.scrollView.add_actor(this.box);

        this.imgbox.add(this.icon, { x_fill: false, x_align: St.Align.MIDDLE });
        this.icon.hide();
        this.box.add(this.label, { x_fill: false, x_align: St.Align.MIDDLE });
        this.actor.set_vertical(true);
        this.actor.add(this.imgbox);
        this.actor.add(this.scrollView);
        this.scrollView.hide();

    },

    setLyrics: function (lrc, pic) {
        this.lyrics = lrc;
        this.label.text = this.lyrics;
        this.scrollView.show();
        if (pic) {
            this.icon.gicon = Gio.icon_new_for_string(pic);
            this.icon.show();
        }
    }
});

const Popup = new Lang.Class({
    Name: 'Popup',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent({
            hover: false,
            activate: false,
            can_focus: true,
        });

        this.lyrics_finder = new Lyrics.LyricsFinder();

        this.createUi();

    },

    createUi: function () {
        this.box = new St.BoxLayout({
            vertical: true,
            width: 350,
            style: 'spacing: 5px;'
        });
        this.actor.add(this.box);

        this.search_label = new St.Label({
            text: "Search lyrics",
            style: 'font-weight: bold',
        });

        this.titleEntry = new St.Entry({
            name: "Title",
            hint_text: 'Song Title...',
            track_hover: true,
            can_focus: true
        });

        this.artistEntry = new St.Entry({
            name: "Artist",
            hint_text: 'Artist...',
            track_hover: true,
            can_focus: true
        });

        this.box.add(this.search_label, { x_fill: false, x_align: St.Align.MIDDLE });
        this.box.add_child(this.titleEntry);
        this.box.add_child(this.artistEntry);

        this.search_btn = new St.Button({
            label: 'Search',
            reactive: true,
            style_class: 'system-menu-action'
        });

        this.search_btn.connect('clicked', Lang.bind(this, function() {
            if (this.loading) {
                return;
            }

            let title = this.titleEntry.text;
            let artist = this.artistEntry.text;

            if (title.trim().length < 1) {
                return;
            }

            if (search_menu != null) {
                search_menu.destroy();
                search_menu = null;
            }
            this.searchSong(title, artist);
        }));

        this.box.add(this.search_btn, { x_fill: false, x_align: St.Align.MIDDLE });

        this.manager = new Manager.PlayerManager(Lang.bind(this, function(title, artist) {
            if (!title || !artist) {
                title = artist = '';
                this.titleEntry.text = title;
                this.artistEntry.text = artist;
                if (this.lrcPanel) {
                    this.lrcPanel.destroy();
                    this.lrcPanel = null;
                }
                if (search_menu != null) {
                    search_menu.destroy();
                    search_menu = null;
                }
                return;
            }

            this.titleEntry.text = title;
            this.artistEntry.text = artist;
            this.searchSong(title, artist);
        }));


    },

    searchSong: function (title, artist) {

        if (this.lrcPanel) {
            this.lrcPanel.destroy();
            this.lrcPanel = null;
        }

        this.lrcPanel = new LyricsPanel();
        let storage_manager = new Storage.StorageManager();

        this.setLoading(false);
        this.setLoading(true);

        this.lyrics_finder.find_lyrics(title, artist,
            Lang.bind(this, function(songs) {

                if (search_menu != null) {
                    search_menu.destroy();
                    search_menu = null;
                }
                search_menu = new PopupMenu.PopupSubMenuMenuItem(`Found: ${songs.length}`);
                button.add_item(search_menu);

                if (songs.length > 0) {
                    songs.forEach((song) => {
                        search_menu.menu.addMenuItem(new Lyrics.LyricsItem(song, this.lrcPanel, search_menu,
                            storage_manager, title, artist));
                    });
                } else {
                    search_menu.menu.addMenuItem(new Lyrics.LyricsItem({ name: "No lyrics found", artists: [{ name: "Error" }] }));
                }
                

                if (storage_manager.is_lyrics_available(title, artist)) {
                    this.lrcPanel.setLyrics(storage_manager.get_lyrics(title, artist),
                                                      storage_manager.get_image(title, artist));
                } else {
                    if (songs.length > 0)
                        search_menu.menu.firstMenuItem.activate();
                }
                this.setLoading(false);
                button.add_item(this.lrcPanel);
            }));

    },

    setLoading: function (state) {
        this.loading = state;
        if (!state) {
            if (this.spinner && this.loadtxt) {
                this.spinner.actor.destroy();
                this.loadtxt.destroy();
            }
            return;
        }
        let spinnerIcon = Gio.File.new_for_uri('resource:///org/gnome/shell/theme/process-working.svg');
        this.spinner = new Animation.AnimatedIcon(spinnerIcon, 16);
        this.spinner.play();
        this.loadtxt = new St.Label({ text: "Searching..." });
        this.box.add(this.loadtxt, { x_fill: false, x_align: St.Align.MIDDLE });
        this.box.add_child(this.spinner.actor);
    },

    disconnect: function () {
        this.manager.disconnect_all();
    }

});

const Button = new Lang.Class({
    Name: 'Button',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(0.0, "LyricsFinder");

        let box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });
        let icon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + "/music-symbolic.svg"),
            style_class: 'system-status-icon',
        });
        box.add_actor(icon);
        this.actor.add_actor(box);
        this.actor.add_style_class_name('panel-status-button');

        popup = new Popup();
        this.menu.addMenuItem(popup);

    },
    add_item: function (item) {
        this.menu.addMenuItem(item);
    }
});


function init() {
}

let button;
let popup;
let search_menu;
let lyrics_panel;

function enable() {
    button = new Button();
    Main.panel.addToStatusArea('lyrics-finder', button);
}

function disable() {
    popup.disconnect();
    popup.destroy();
    button.destroy();
}
