const Animation = imports.ui.animation;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const Manager = Me.imports.dbus_manager;
const Lyrics = Me.imports.lyrics_api;
const Storage = Me.imports.storage;
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;

const ALIGN_MIDDLE_X = { x_expand: false, x_align: Clutter.ActorAlign.CENTER };
const ALIGN_MIDDLE_Y = { y_expand: false, y_align: Clutter.ActorAlign.CENTER };

const settings = Convenience.getSettings();

const LyricsPanel = GObject.registerClass(
    {
        GtypeName: 'LyricsPanel'
    },
    class extends PopupMenu.PopupBaseMenuItem {

    _init() {
        super._init({
            hover: false,
            activate: false,
            can_focus: true,
        });
        this.lyrics = '... No lyrics ...\nJust play some music!';
        this.hasLyrics = false;

        this.label = new St.Label({
            text: this.lyrics,
            style: this.getLyricsStyle(),
            ...ALIGN_MIDDLE_X
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
            style_class: 'system-menu-action',
            ...ALIGN_MIDDLE_X
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
            ...ALIGN_MIDDLE_X
        });

        this.box.add_child(this.icon);

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

        this.box.add_child(this.copyBtn);
        this.box.add_child(this.label);
        this.set_vertical(true);
        this.add_child(this.scrollView);

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

        settings.connect('changed::' + Keys.USE_COLOR, () => {
            this.label.style = this.getLyricsStyle();
        });

        settings.connect('changed::' + Keys.COLOR, () => {
            this.label.style = this.getLyricsStyle();
        });
    }

    getCoverSize() {
        let size = settings.get_int(Keys.COVER_SIZE);
        size = size < 80 ? 80 : size;
        size = size > 200 ? 200 : size;
        return size;
    }

    getLyricsStyle(){
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

        const useColor = settings.get_boolean(Keys.USE_COLOR);
        const color = settings.get_string(Keys.COLOR);

        return `padding: 10px;
                font-size: ${settings.get_int(Keys.TEXT_SIZE)}pt;
                text-align: ${settings.get_string(Keys.TEXT_ALIGN)};
                font-family: "${name}";
                font-weight: ${fontWeight};
                font-style: ${fontStyle};` + `${useColor ? `color: ${color}` : ''}`;
    }

    setLyrics(lrc, pic) {
        this.lyrics = lrc.trim();
        this.label.text = this.lyrics;
        this.hasLyrics = true;
        if (pic) {
            if (this.isCoverEnabled()) {
                let gicon = Gio.icon_new_for_string(pic);

                if (gicon != null)
                    this.icon.set_gicon(gicon);
               else
                   this.icon.icon_name = Me.path + '/album-art-empty.png';

                this.icon.show();
            }
            this.pic = pic;
        }
        this.copyBtn.show();

        // Scroll to top
        this.scrollView.vscroll.adjustment.set_value(0);
    }

    isCoverEnabled() {
        return settings.get_boolean(Keys.ENABLE_COVER);
    }

    reset() {
        this.setLyrics('... No lyrics ...\nJust play some music!', Me.path + '/album-art-empty.png');
        this.hasLyrics = false;
        this.copyBtn.hide();
    }
});

const LyricsPopup = GObject.registerClass(
    {
        GTypeName: 'LyricsPopup'
    },
    class LyricsPopup extends PopupMenu.PopupBaseMenuItem {

    _init() {
        super._init({
            hover: false,
            activate: false,
            can_focus: true,
        });

        this.lyrics_finder = new Lyrics.LyricsFinder();

        this.createUi();
    }

    createUi() {
        this.spinnerIcon = Gio.File.new_for_uri('resource:///org/gnome/shell/theme/process-working.svg');
        this.spinner = new Animation.AnimatedIcon(this.spinnerIcon, 16);
        this.spinner.x_align = Clutter.ActorAlign.CENTER;
        this.spinner.x_expand = true;
        this.spinner.play();
        this.loadtxt = new St.Label({ text: "Searching..." , ...ALIGN_MIDDLE_X});

        this.box = new St.BoxLayout({
            vertical: true,
            width: settings.get_int(Keys.PANEL_WIDTH),
            style: 'spacing: 5px;'
        });
        settings.connect('changed::' + Keys.PANEL_WIDTH, () => {
            this.box.width = settings.get_int(Keys.PANEL_WIDTH);
        });

        this.add_child(this.box);

        this.topBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        this.searchLabel = new St.Label({
            text: "Lyrics Finder",
            style: 'font-weight: bold',
        });
        this.topBox.add_child(this.searchLabel);

        this.prefsBtn = new St.Button({
            child: new St.Icon({
                icon_name: 'emblem-system-symbolic',
                icon_size: 15,
            }),
            reactive: true,
            can_focus: true,
            style_class: 'button system-menu-action'
        });
        this.prefsBtn.connect('clicked', () => ExtensionUtils.openPrefs());

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
            can_focus: true,
        });

        this.box.add_child(this.topBox);
        this.box.add_child(this.titleEntry);
        this.box.add_child(this.artistEntry);

        this.SearchBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 3px;',
        });
        this.SearchBox.add_child(new St.Icon({
            icon_name: 'system-search-symbolic',
            icon_size: 20 ,
            ...ALIGN_MIDDLE_Y
        }));
        this.SearchBox.add_child(new St.Label({ text: 'Search' , ...ALIGN_MIDDLE_Y}));

        this.search_btn = new St.Button({
            child: this.SearchBox,
            reactive: true,
            style_class: 'button system-menu-action',
            ...ALIGN_MIDDLE_X
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

        this.box.add_child(this.search_btn);

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
                this.lyrics_finder.cancel_last_search();
                this.loadSong(title, artist);
                search_menu.menu.removeAll();
                search_menu.label.set_text('Found');
            } else {
                if (settings.get_boolean(Keys.AUTO_SEARCH)) {
                    this.searchSong(title, artist);
                } else {
                    lrcPanel.reset();
                }
            }

        }));
    }

    loadSong(title, artist) {
        lrcPanel.reset();

        const storage_manager = new Storage.StorageManager();
        lrcPanel.setLyrics(storage_manager.get_lyrics(title, artist),
            storage_manager.get_image(title, artist));

        this.setLoading(false);
    }

    searchSong(title, artist) {
        lrcPanel.reset();

        const storage_manager = new Storage.StorageManager();

        this.setLoading(true);
        // Just to make sure that it will be cleared
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            if (this.loading) {
                this.setLoading(false);
            }
            return false;
        });

        this.lyrics_finder.find_lyrics(title, artist,
            Lang.bind(this, function (songs) {
                this.setLoading(false);
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
            }));
    }

    setLoading(state) {
        this.loading = state;
        if (state) {
            this.box.add_child(this.loadtxt);
            this.box.add_child(this.spinner);
        } else {
            this.box.remove_child(this.loadtxt);
            this.box.remove_child(this.spinner);
        }
    }

    disconnect() {
        this.manager.disconnect_all();
    }

});

var LyricsFinderPanelButton = GObject.registerClass(class LyricsFinderPanelButton extends PanelMenu.Button {

    _init() {
        super._init(0.0, "LyricsFinder");

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });
        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + "/music-symbolic.svg"),
            style_class: 'system-status-icon',
        });
        box.add_actor(icon);
        this.add_actor(box);
        this.add_style_class_name('panel-status-button');

        popup = new LyricsPopup();
        this.menu.addMenuItem(popup);
        search_menu = new PopupMenu.PopupSubMenuMenuItem('Found: 0');
        this.menu.addMenuItem(search_menu);

        lrcPanel = new LyricsPanel();
        lrcPanel.reset();
        this.menu.addMenuItem(lrcPanel);
    }
});


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
    button = new LyricsFinderPanelButton();

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
