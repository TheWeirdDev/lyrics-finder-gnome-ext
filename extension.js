const Animation = imports.ui.animation;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const Shell = imports.gi.Shell;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const Manager = Me.imports.dbus_manager;
const Lyrics = Me.imports.lyrics_api;
const Storage = Me.imports.storage;
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;

const ALIGN_MIDDLE_X = { x_fill: false, x_align: St.Align.MIDDLE };
const ALIGN_MIDDLE_Y = { y_fill: false, y_align: St.Align.MIDDLE };

const settings = Convenience.getSettings();

const LyricsPanel = new Lang.Class({
    Name: 'Popup',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function () {
        this.parent({
            hover: false,
            activate: false,
            can_focus: true,
        });
        this.lyrics = '... No lyrics ...\nJust play a music!';
        this.hasLyrics = false;

        this.label = new St.Label({
            text: this.lyrics,
            style: this.getLyricsStyle()

        });
        this.label.clutter_text.line_wrap = true;
        this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.box = new St.BoxLayout({
            vertical: true,
            width: settings.get_int(Keys.PANEL_WIDTH),
            style: 'spacing: 5px;'
        });
        settings.connect('changed::' + Keys.PANEL_WIDTH, () => {
            this.box.width = settings.get_int(Keys.PANEL_WIDTH);
        });

        this.copyBtn = new St.Button({
            label: 'Copy lyrics',
            reactive: true,
            can_focus: true,
            style_class: 'system-menu-action'
        });
        this.copyBtn.connect('clicked', () => {
            if (this.hasLyrics)
                Clipboard.set_text(CLIPBOARD_TYPE, this.lyrics);
        });
        this.copyBtn.hide();

        this.scrollView = new St.ScrollView();
        this.scrollView._delegate = this;
        this.scrollView.clip_to_allocation = true;

        this.scrollView.add_actor(this.box);
        this.icon = new St.Icon({
            icon_size: this.getCoverSize(),
        });

        this.box.add(this.icon, ALIGN_MIDDLE_X);

        if (!this.isCoverEnabled()) {
            this.icon.hide();
        }

        settings.connect('changed::' + Keys.ENABLE_COVER, () => {
            if (this.isCoverEnabled()) {
                const gicon = Gio.icon_new_for_string(this.pic);
                if (gicon != null)
                    this.icon.gicon = gicon;
                this.icon.show();
            } else {
                this.icon.hide();
            }
        });

        this.box.add(this.copyBtn, ALIGN_MIDDLE_X);
        this.box.add(this.label, ALIGN_MIDDLE_X);
        this.actor.set_vertical(true);
        this.actor.add(this.scrollView);

        settings.connect('changed::' + Keys.COVER_SIZE, () => {
            this.icon.icon_size = this.getCoverSize();
        });

        settings.connect('changed::' + Keys.TEXT_SIZE, () => {
            this.label.style = this.getLyricsStyle();
        });

        settings.connect('changed::' + Keys.FONT_NAME, () => {
            this.label.style = this.getLyricsStyle();
        });

        settings.connect('changed::' + Keys.TEXT_ALIGN, () => {
            this.label.style = this.getLyricsStyle();
        });
    },

    getCoverSize: function () {
        let size = settings.get_int(Keys.COVER_SIZE);
        size = size < 80 ? 80 : size;
        size = size > 200 ? 200 : size;
        return size;
    },

    getLyricsStyle() {
        const fontName = settings.get_string(Keys.FONT_NAME).split(' ');

        let name = [];
        let fontWeight = 'normal';
        let fontStyle = 'normal';

        fontName.forEach(item => {
            switch (item) {
                case 'Regular':
                    fontWeight = 'normal';
                    break;
                case 'Bold':
                    fontWeight = 'bold';
                    break;
                case 'Italic':
                    fontStyle = 'italic';
                    break;
                case 'Oblique':
                    fontStyle = 'oblique';
                    break;

                default:
                    name.push(item);
            }
        });
        name = name.join(' ');

        return `padding: 10px;
                font-size: ${settings.get_int(Keys.TEXT_SIZE)}pt;
                text-align: ${settings.get_string(Keys.TEXT_ALIGN)};
                font-family: "${name}";
                font-weight: ${fontWeight};
                font-style: ${fontStyle};`;
    },

    setLyrics: function (lrc, pic) {
        this.lyrics = lrc.trim();
        this.label.text = this.lyrics;
        this.hasLyrics = true;
        if (pic) {
            if (this.isCoverEnabled()) {
                const gicon = Gio.icon_new_for_string(pic);
                if (gicon != null)
                    this.icon.gicon = gicon;
                else
                    this.icon.icon_name = Me.path + '/album-art-empty.png';

                this.icon.show();
            }
            this.pic = pic;
        }
        this.copyBtn.show();

        // Scroll to top
        this.scrollView.vscroll.adjustment.set_value(0);
    },

    isCoverEnabled: function () {
        return settings.get_boolean(Keys.ENABLE_COVER);
    },

    reset: function () {
        this.setLyrics('... No lyrics ...\nJust play a music!', Me.path + '/album-art-empty.png');
        this.hasLyrics = false;
        this.copyBtn.hide();
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
            width: settings.get_int(Keys.PANEL_WIDTH),
            style: 'spacing: 5px;'
        });
        settings.connect('changed::' + Keys.PANEL_WIDTH, () => {
            this.box.width = settings.get_int(Keys.PANEL_WIDTH);
        });

        this.actor.add(this.box);

        this.topBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px;',
        });

        this.searchLabel = new St.Label({
            text: "Lyrics Finder",
            style: 'font-weight: bold',
        });
        this.topBox.add(this.searchLabel, ALIGN_MIDDLE_Y);

        this.prefsBtn = new St.Button({
            child: new St.Icon({
                icon_name: 'emblem-system-symbolic',
                icon_size: 15,
            }),
            reactive: true,
            can_focus: true,
            style_class: 'system-menu-action'
        });
        this.prefsBtn.connect('clicked', launch_extension_prefs);

        this.topBox.add_child(this.prefsBtn);

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

        this.box.add(this.topBox, ALIGN_MIDDLE_X);
        this.box.add_child(this.titleEntry);
        this.box.add_child(this.artistEntry);

        this.SearchBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 3px;',
        });
        this.SearchBox.add(new St.Icon({ icon_name: 'system-search-symbolic', icon_size: 20 }), ALIGN_MIDDLE_Y);
        this.SearchBox.add(new St.Label({ text: 'Search' }), ALIGN_MIDDLE_Y);

        this.search_btn = new St.Button({
            child: this.SearchBox,
            reactive: true,
            style_class: 'system-menu-action'
        });

        this.search_btn.connect('clicked', Lang.bind(this, function () {
            if (this.loading) {
                return;
            }

            const title = this.titleEntry.text;
            const artist = this.artistEntry.text;

            if (title.trim().length < 1) {
                return;
            }
            this.searchSong(title, artist);
            search_menu.menu.removeAll();
            search_menu.label.set_text('Found: 0');
        }));

        this.box.add(this.search_btn, ALIGN_MIDDLE_X);

        this.manager = new Manager.PlayerManager(Lang.bind(this, function (title, artist) {
            if (!title) {
                title = artist = '';
                this.titleEntry.text = title;
                this.artistEntry.text = artist;

                lrcPanel.reset();

                search_menu.menu.removeAll();
                search_menu.label.set_text('Found: 0');
                return;
            }
            if (settings.get_boolean(Keys.REMOVE_EXTRAS)) {
                title = title.replace(/\(.*\)/, '').replace(/\[.*\]/, '').replace(/::.*::/, '').trim();
                if (artist)
                    artist = artist.replace(/\(.*\)/, '').replace(/\[.*\]/, '').replace(/::.*::/, '').trim();
            }

            this.titleEntry.text = title;
            this.artistEntry.text = artist;

            const storage_manager = new Storage.StorageManager();

            if (storage_manager.is_lyrics_available(title, artist)) {
                this.loadSong(title, artist);
                search_menu.label.set_text('Found');
            } else {
                if (settings.get_boolean(Keys.AUTO_SEARCH)) {
                    this.searchSong(title, artist);
                } else {
                    lrcPanel.reset();
                }
            }

        }));

    },
    loadSong: function (title, artist) {
        lrcPanel.reset();

        const storage_manager = new Storage.StorageManager();
        lrcPanel.setLyrics(storage_manager.get_lyrics(title, artist),
            storage_manager.get_image(title, artist));
    },

    searchSong: function (title, artist) {

        lrcPanel.reset();

        const storage_manager = new Storage.StorageManager();

        this.setLoading(false);
        this.setLoading(true);

        this.lyrics_finder.find_lyrics(title, artist,
            Lang.bind(this, function (songs) {

                search_menu.menu.removeAll();
                search_menu.label.set_text(`Found: ${songs.length}`);

                if (songs.length > 0) {
                    songs.forEach((song) => {
                        search_menu.menu.addMenuItem(new Lyrics.LyricsItem(song, lrcPanel, search_menu,
                            storage_manager, title, artist));
                    });

                    search_menu.menu.firstMenuItem.activate();

                } else {
                    search_menu.menu.addMenuItem(new Lyrics.LyricsItem({ name: "No lyrics found", artists: [{ name: "Error" }] }));
                }

                this.setLoading(false);

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
        const spinnerIcon = Gio.File.new_for_uri('resource:///org/gnome/shell/theme/process-working.svg');
        this.spinner = new Animation.AnimatedIcon(spinnerIcon, 16);
        this.spinner.play();
        this.loadtxt = new St.Label({ text: "Searching..." });
        this.box.add(this.loadtxt, ALIGN_MIDDLE_X);
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

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });
        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + "/music-symbolic.svg"),
            style_class: 'system-status-icon',
        });
        box.add_actor(icon);
        this.actor.add_actor(box);
        this.actor.add_style_class_name('panel-status-button');

        popup = new Popup();
        this.menu.addMenuItem(popup);
        search_menu = new PopupMenu.PopupSubMenuMenuItem('Found: 0');
        this.add_item(search_menu);

        lrcPanel = new LyricsPanel();
        lrcPanel.reset();
        this.add_item(lrcPanel);

    },
    add_item: function (item) {
        this.menu.addMenuItem(item);
    }
});

function launch_extension_prefs() {
    const appSys = Shell.AppSystem.get_default();
    const app = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
    const info = app.get_app_info();
    const timestamp = global.display.get_current_time_roundtrip();
    info.launch_uris(
        ['extension:///' + Me.metadata.uuid],
        global.create_app_launch_context(timestamp, -1)
    );
}


function init() {
}

let button;
let popup;
let search_menu;
let lrcPanel;
let pos;
let settingsSignals = [];

function reset() {
    disable();
    enable();
}

function enable() {
    button = new Button();

    pos = settings.get_string(Keys.PANEL_POS);
    settingsSignals.push(settings.connect('changed::' + Keys.PANEL_POS, reset));
    Main.panel.addToStatusArea('lyrics-finder', button, 1, pos);
}


function disable() {
    popup.disconnect();
    popup.destroy();
    button.destroy();
    settings.disconnect(settingsSignals);
    settingsSignals = [];
    Main.panel.statusArea['lyrics-finder'] = null;
    button = null;
    popup = null;
}
