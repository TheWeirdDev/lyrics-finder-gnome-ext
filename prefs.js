const { GLib, GObject, Gio, Gtk, Gdk } = imports.gi;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;

const DATA_DIRECTORY = GLib.get_home_dir() + "/.gnome-lyrics-extension/";

let settings;
function init() {
    settings = Convenience.getSettings();
}

function buildPrefsWidget() {

    const builder = new Gtk.Builder();
    builder.add_from_file(Me.dir.get_path() + '/prefs.ui');
    const box = builder.get_object('prefs_widget');

    builder.get_object('extension_version').set_text(Me.metadata.version.toString());

    const removeExtrasSwitch = builder.get_object('remove_extras');
    const albumCoverSwitch = builder.get_object('enable_cover');
    const panelPosition = builder.get_object('panel_pos');
    const searchLimit = builder.get_object('search_limit');
    const coverSize = builder.get_object('cover_size');
    const fontChooser = builder.get_object('font_chooser');
    const lyricsAlign = builder.get_object('lyrics_align');
    const clearCache = builder.get_object('clear_cahe');
    const cacheSize = builder.get_object('cache_size');
    const autoSearchSwitch = builder.get_object('auto_search');
    const saveLyricsSwitch = builder.get_object('save_lyrics');
    const panelWidth = builder.get_object('panel_width');
    const useColor = builder.get_object('use_color');
    const colorPicker = builder.get_object('color_picker');

    // Remove extras
    settings.bind(Keys.REMOVE_EXTRAS, removeExtrasSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    // Album cover
    settings.bind(Keys.ENABLE_COVER, albumCoverSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    // Auto search
    settings.bind(Keys.AUTO_SEARCH, autoSearchSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    // save lyrics
    settings.bind(Keys.SAVE_LYRICS, saveLyricsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);


    // Panel Position
    panelPosition.set_active_id(settings.get_string(Keys.PANEL_POS));

    panelPosition.connect('changed', function (widget) {
        settings.set_string(Keys.PANEL_POS, widget.get_active_text().toLowerCase());
    });

    // Search limit
    settings.bind(Keys.SEARCH_LIMIT, searchLimit, 'value', Gio.SettingsBindFlags.DEFAULT);

    // Panel width
    settings.bind(Keys.PANEL_WIDTH, panelWidth, 'value', Gio.SettingsBindFlags.DEFAULT);

    // Cover size
    settings.bind(Keys.COVER_SIZE, coverSize, 'value', Gio.SettingsBindFlags.DEFAULT);

    // Font chooser
    fontChooser.set_font(`${settings.get_string(Keys.FONT_NAME)} ${settings.get_int(Keys.TEXT_SIZE)}`);
    fontChooser.connect("font-set", function (widget) {
        const fullName = fontChooser.get_font().split(' ');
        const size = parseInt(fullName[fullName.length - 1]);

        const name = fullName.slice(0, fullName.length - 1).join(' ');

        settings.set_int(Keys.TEXT_SIZE, size);
        settings.set_string(Keys.FONT_NAME, name);

    });

    // Text align
    settings.bind(Keys.TEXT_ALIGN, lyricsAlign, 'active_id', Gio.SettingsBindFlags.DEFAULT);

    // Text color
    settings.bind(Keys.USE_COLOR, useColor, 'active', Gio.SettingsBindFlags.DEFAULT);

    let _color = getColorByHexadecimal(settings.get_string(Keys.COLOR));
    colorPicker.set_rgba(_color);

    colorPicker.connect('color-set', function (innerColor) {
        settings.set_string(Keys.COLOR, getHexadecimalByColor(innerColor.get_rgba()));
    });


    function calculateCacheSize() {
        const file = Gio.file_new_for_path(DATA_DIRECTORY);
        const file_exists = file.query_exists(null);
        const file_type = file_exists ? file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) : 0;

        if (file_exists && file_type == Gio.FileType.DIRECTORY) {
            const [result, stdout, , exit_code] = GLib.spawn_sync(null, ['du', '-csb', DATA_DIRECTORY], null, GLib.SpawnFlags.SEARCH_PATH, null);
            if (result && exit_code == 0) {
                const size = stdout.toString().split('\t')[0];
                cacheSize.set_text(GLib.format_size_for_display(parseInt(size)));
                return;
            }
        }
        cacheSize.set_text(GLib.format_size(0));
    }
    calculateCacheSize();

    // Clear the cache
    clearCache.connect('clicked', () => {
        const file = Gio.file_new_for_path(DATA_DIRECTORY);
        const file_exists = file.query_exists(null);
        const file_type = file_exists ? file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) : 0;

        if (file_exists && file_type == Gio.FileType.DIRECTORY) {
            const enumerator = file.enumerate_children('*', Gio.FileQueryInfoFlags.NONE, null);

            let file_info;
            while ((file_info = enumerator.next_file(null)) != null) {
                const child = file.get_child(file_info.get_name());
                child.delete(null);
            }
        }
        calculateCacheSize();
    });
    box.show();

    return box;
}


function getColorByHexadecimal(hex) {
    let color = new Gdk.RGBA();
    if (!color.parse(hex)) {
        color = new Gdk.RGBA({ red: 1 });
    }
    return color;
}

function getHexadecimalByColor(color) {
    let red = Math.floor(color.red * 255).toString(16).padStart(2, "0");
    let green = Math.floor(color.green * 255).toString(16).padStart(2, "0");
    let blue = Math.floor(color.blue * 255).toString(16).padStart(2, "0");
    return '#' + red + green + blue;
}