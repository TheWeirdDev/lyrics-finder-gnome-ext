const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

const DATA_DIRECTORY = GLib.get_home_dir() + "/.gnome-lyrics-extension/";

var StorageManager = new Lang.Class({
    Name: 'StorageManager',

    _init: function () {
        
    },

    _download_album_art: function (url, file) {
        const fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        const request = Soup.Message.new('GET', url);

        // got_chunk event
        request.connect('got_chunk', Lang.bind(this, function (message, chunk) {
            fstream.write(chunk.get_data(), null);
        }));

        const httpSession = new Soup.SessionAsync();   
        httpSession.queue_message(request, Lang.bind(this, function (httpSession, message) {
            // request completed
            fstream.close(null);
            if (message.status_code == 200) {
                global.log('Download successful');
            } else {
                global.log("Couldn't fetch image from " + url);
                file.delete(null);
            }
        }));
    },

    _save_lyrics: function (title, artist, lyrics) {
        const lyrics_name = this._make_lyrics_filename(title, artist);
        const file = Gio.file_new_for_path(lyrics_name);
        if (file){
            this._create_dir(DATA_DIRECTORY);
            const raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            const out = Gio.BufferedOutputStream.new_sized(raw, 4096);
            Shell.write_string_to_stream(out, lyrics);
            out.close(null);
        }
    },
    _save_image: function(title, artist, pic_url){
        const pic_name = this._make_image_filename(title, artist);
        const file = Gio.file_new_for_path(pic_name);
        if (file){
            this._create_dir(DATA_DIRECTORY);
            this._download_album_art(pic_url, file);
        }
    },

    is_lyrics_available: function(title, artist){
        const filename = this._make_lyrics_filename(title, artist);
        return Gio.file_new_for_path(filename).query_exists(null);
    },

    save: function(title, artist, lyrics, pic_url){
        this._save_lyrics(title, artist , lyrics);
        this._save_image(title, artist, pic_url);
    },

    get_image_gicon: function(title, artist){
        let filename = '';
        if (this.is_lyrics_available(title , artist)){
            filename = this._make_image_filename(title, artist);
        }
        return Gio.icon_new_for_string(filename);
    },
    get_image: function(title, artist){
        let filename = '';
        if (this.is_lyrics_available(title , artist)){
            filename = this._make_image_filename(title, artist);
        }
        return filename;
    },
    get_lyrics: function(title, artist){
        const filename = this._make_lyrics_filename(title, artist);
        let content ='';
        try {
            content = Shell.get_file_contents_utf8_sync(filename);
        } catch (e) {
            global.logError('Failed to load lyrics: ' + e);
            return content;
        }
        return content;
    },

    _create_dir: function (dir_path) {
        let dir = Gio.file_new_for_path(dir_path);
        if (!dir.query_exists(null)) {
            try {
                dir.make_directory(null);
            } catch (e) {
                global.logError('Failed to create directory and/or file! ' + e);
            }
        }
    },
    _make_image_filename: function(title , artist){
        return DATA_DIRECTORY + `${title}_${artist}`.replace(/[\s\/]/g, '_');
    },
    _make_lyrics_filename: function(title , artist){
        return this._make_image_filename(title , artist) + '.lyrics';
    },
});