;(function ( Binder ) {
    /* jshint laxcomma: true */
    "use strict";

    var object = Binder.object
        , define = Binder.define
        , on     = Binder.on
        ;

    //spotify api init
    var sp = getSpotifyApi();
    var models = sp.require('$api/models');
    var views = sp.require('$api/views');

    //oscillator config values
    var defaultConfig = {
        //echonest api parameters
        echonest: {
            apiKey: "2FOIUUMCRLFMAWJXT",
            playlistType: "static",
            radioType: "song-radio",//[artist-radio, song-radio, genre-radio]
            variety: 1, //[0,1], default=0.5
            distribution: "wandering", //focused || wandering, default=focused
            mood: "relaxing", //[happy, angry, sag, relaxing, excited]
        },
        playlist: {
            suffix: "#oscillator", 
            songNumber: 20
        },
        history: {
            slider: {
                step: 4,
                minimum: 8
            }
        },
        filters: {
            startWithSeed: 1,
            //avoid artist and track repetition?
            artistRepetition: 1,
            trackRepetition: 0,
            autoload: 1,
            saveHistory: 1,
        },
    };
    var config = new Object();
    if( localStorage.getItem("config") ) {
        config = JSON.parse( localStorage.getItem("config") );
    }
    //merge default config into config obj
    var tmp = jQuery.extend(true, {}, defaultConfig);
    config = jQuery.extend(true, tmp, config);

    var history = new Array();
    if( localStorage.getItem("history") ) {
        history = JSON.parse( localStorage.getItem("history") );
    }

    /*TAB SWITCHING*/
    models.application.observe(models.EVENT.ARGUMENTSCHANGED, tabs);
    function tabs() {
        var args = models.application.arguments;

        var current  = document.getElementById(args[0]);
        if(!current)
            return;

        var tabs     = document.getElementsByClassName('tabs');
        for (var i = 0, l = tabs.length; i < l; i++){
            if (current != tabs[i]) {
                tabs[i].classList.add( 'hidden' );
            }
        }
        current.classList.remove( 'hidden' );
    }

    var currentTracks = new Array();
    //converts a list of tracks to a spotify playlist object
    function listOfTracks2Playlist( tracks ) {
        var playlist = new models.Playlist();

        //empty current tracks
        currentTracks.length = 0; 

        for ( var i=0; i < tracks.length; i++ ) {
            var uri;
            if( tracks[i].artist_id ) {
                uri = tracks[i].tracks[0].foreign_id.replace('-WW', '');
            }
            else//accept spotify tracks (like a seed, for instance)
                uri = tracks[i].data.uri;

            if( uri ) {
                var track = models.Track.fromURI( uri );

                currentTracks.push( track );
                playlist.add( track );
            }
        }

        return playlist;
    }

    function htmlentities( html ) {
        var text;

        if( html !== undefined )
            text = $("<div/>").html( html ).text().toLowerCase().trim();

        return text;
    }

    function filterSongs( songs, seed ) {
        var artists = new Array();
        var tracks  = new Array();

        var filteredSongs = new Array();

        //add seed to the beginning of playlist
        if( config.filters.startWithSeed )
            songs.unshift( seed );

        for ( var i = 0; i < songs.length; i++ ) {
            var song = songs[i];
            var name;
            //spotify track object
            if( song.data )
                name = song.data.artists[0].name;
            //regular echonest object
            else
                name = song.artist_name;

            if( name ) {
                //remove html entities from string
                name = htmlentities( name );
            }

            var title;
            //spotify track object
            if( song.data )
                title = song.name;
            //regular echonest object
            else 
                title = song.title;

            if( title ) {
                //remove html entities from string
                title = htmlentities( title );
            }

            //check for artist duplication
            if( config.filters.artistRepetition ) {
                if( artists.indexOf( name ) == -1 ) {
                    artists.push( name );
                }
                else
                    continue;
            }

            //check track duplications (unless track flagged in artist repetition check)
            if( config.filters.trackRepetition ) {
                if( tracks.indexOf( name + title ) == -1 ) {
                    tracks.push( name + title );
                }
                else
                    continue;
            }

            //add song to filtered array
            filteredSongs.push( song );
        }

        return filteredSongs;
    }

    define('AppForm', Binder, {
        constructor: function () {
            this.isContext = true;
            this.whoSubmitted = '';

            Binder.apply( this, arguments );

            on( this, 'submit');
            on( this, 'dragenter' );
            on( this, 'dragover' );
            on( this, 'drop' );
        }
        , dragenter: function( e ) {
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
        , dragover: function( e ) {
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
        , drop: function ( e ) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();

            var uri = e.dataTransfer.getData('Text');

            var track;
            //accept drag drop of tracks from within oscillator
            if( uri.split(":")[1] == "track" ) {
                track = models.Track.fromURI( uri );
            }
            //from outside oscillator
            else if( uri.match(/open.spotify.com\/track\/.+$/i) ) {
                var splitted = uri.split("/");
                var new_uri = "spotify:track:" + splitted.pop(); 
                track = models.Track.fromURI( new_uri );
            }

            if( track )
                this._getPlaylistFromEchonest( track );

            return false;
        }
      , submit: function ( event ) {
            if ( event )
                event.preventDefault();
            //use as seed a random track from library
            if( this.whoSubmitted === 'Random' ) {
                var max = models.library.tracks.length;
                if( max ) {
                    var random_number = Math.floor( Math.random() * max );

                    var seed = models.library.tracks[ random_number ];

                    //get the playlist for the seed
                    this._getPlaylistFromEchonest( seed );
                }
                else {
                    var msg = "Your library is empty. Oscillator can not get a random song from your library... You should use the search songs feature instead.";
                    this.Error.update( msg );
                }
            }
            //search spotify api for artists
            else {
                //search for artists
                var query = this.Query.elem.value;

                this._doSearch( query );
            }

            return false;
        },
        _getPlaylistFromEchonest: function( seed ) {
            if( !seed ) {
                var msg = "Must supply radio seed to echonest";
                this.Error.update( msg );
                return;
            }

            var request = {
//                    format:'jsonp',
                    limit: true,
                    results: config.playlist.songNumber,
                    type: config.echonest.radioType,
                    variety: config.echonest.variety,
                    distribution: config.echonest.distribution,
                    //make echonest send spotify song ids
                    bucket: ['id:spotify-WW', 'tracks']
                };
            if( config.echonest.radioType == 'artist-radio') {
                request.artist_id = seed.artists[0].uri.replace('spotify', 'spotify-WW');
            }
            else if( config.echonest.radioType == 'song-radio') {
                request.track_id = seed.uri.replace('spotify', 'spotify-WW');
            }

            var url = 'http://developer.echonest.com/api/v4/playlist/' + config.echonest.playlistType + '?api_key=' + config.echonest.apiKey + '&callback=?';

            var that = this;

             /* Set traditional mode in JS */
            $.ajaxSetup({traditional: true, cache: true});
            $.ajax({
                type: 'GET',
                url: url,
                data: request
            }).done(function( data ) { 
                if ( that._checkResponse( data ) ) {

                    //filter songs and update the player/playlist
                    var songs = filterSongs( data.response.songs, seed );

                    that.context.Player.seed = seed;
                    that.context.Player.update( songs );
                }
            }).fail(function() { 
                that.Error.update("Unexpected response from echonest server. Please try again.");
            });

        }
        , _checkResponse: function (data) {
            if ( data.response ) {
                if (data.response.status.code != 0) {
                    this.Error.update("Couldn't get a playlist from echonest: " + data.response.status.message);
                } else {
                    return true;
                }
            } else {
                this.Error.update("Unexpected response from server. Please try again.");
            }
            return false;
        }
        , _doSearch: function ( query ) {
            var search = new models.Search( query );
            search.localResults = models.LOCALSEARCHRESULTS.APPEND;

            var that = this;

            search.observe(models.EVENT.CHANGE, function() {
                var results = search.tracks;
                
                that.context.Results.empty();
                that.context.Results.update( results ); 
                that.context.Results.show();
            });

            search.appendNext();
        }
    });

    var AppButton = define('AppButton', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
            on( this, 'click' );

            this.$ = $( this.elem );
        }
        , click: function () {
            this.context.whoSubmitted = this.name;
        }
    });

    define('AppError', Binder, {
        constructor: function ( elem, parent, args ) {
            this.delay = args.delay || 5000;
            Binder.apply( this, arguments );
        }
        , hide: function () {
            delete this.timeout;
            this.value('');
            return Binder.prototype.hide.call( this );
        }
        , update: function ( data ) {
            this.value( data );
            this.show();
        }
        , show: function () {
            var obj = this;

            Binder.prototype.show.call( obj );
            clearTimeout( obj.timeout );

            obj.timeout = setTimeout( 
                function () { obj.hide(); }, obj.delay 
            );

            return obj;
        }
    });

    define('AppController', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
            this.seed;
        }
        , update: function ( data, playing ) {
            this.show();

            this.seed.data.radioType = config.echonest.radioType;
            var item2config = {
                    'seed'    : this.seed,
                    'playlist': data,
                    'playing' : playing ? 1 : 0,
                };

            //update config with new plailist
            if( config.filters.saveHistory ) {
                history.push( item2config );
                localStorage.setItem( "history", JSON.stringify( history ) );
            }

            var playlist = listOfTracks2Playlist( data );

            //update current player and playlist
            this.Player.update( playlist );
            this.Playlist.update( playlist );

            //update title 
            this.Title.update( this.seed );

            var item2slider = {
                    'seed':     this.seed,
                    'playlist': playlist,
                };

            if( config.filters.saveHistory ) {
                //update history
                var history2render = new Array();
                history2render.push( item2slider );

                this.History.update( history2render );
                this.HistoryContainer.show();
            }
        }
    });

    define('AppTitle', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
        , update: function( seed ) {
            if( !seed )
                return;

            switch ( seed.data.radioType ) {
                case "artist-radio":
                    this.value( 'artist-radio for ' +  seed.data.artists[0].name );
                    break;
                case "song-radio":
                    this.value( 'song-radio for ' +  seed.data.artists[0].name + " - " + seed.data.name );
                    break;
            }
        }
    });

    var AppPlayer = define('AppPlayer', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );

            //instantiate spotify player with some options
            this.player = new views.Player();
            this.player.node.style.backgroundSize = 'cover';
        }
        , update: function ( playlist ) {
            //reset the player and then update it with new playlist
            this.player.track = null;
            this.player.context = playlist;

            //delete current contents and add player to DOM
            $( this.elem ).empty().append( this.player.node );
        }
    });

    define('AppPlaylist', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
        , update: function ( playlist ) {
            var list = new views.List( playlist ); 
   
            //empty and add list view for the player
            $( this.elem ).empty().append( list.node );

            //show save playlist button
            this.context.Save.show();
        }
    });

    /*saves the playlist generated by oscillator*/
    define('AppSavePlaylist', AppButton, {
        click: function () { 
            var title = config.echonest.radioType + " for " + this.context.seed;

            if( config.playlist.suffix ) {
                title = title + " - " + config.playlist.suffix;
            }

            var thePlaylist = new models.Playlist( title );
            //TODO: use the spotify playlist. When doing this, delete currentTracks globalArray.
            for (var i = 0; i < currentTracks.length; i++) {
                thePlaylist.add( currentTracks[i] );
            }
            return false;
        }
    });

    var AppResults = define('AppResults', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
        , update: function ( val ) {
            var obj = this;

            if ( Array.isArray( val ) ) {
                Array.prototype.forEach.call( val, function ( value, index ) {
                    var child = obj.attach( value.template || 0 );
                    if ( value !== void 0 ) {
                        delete value.template;
                        child.update( value );
                    }
                });

                return obj.children();
            }

            return Binder.prototype.update( obj, val );
        }
        , empty: function() {
            var children = this.children(); 
            for ( var i = 0; i < children.length ; i++ ) {
                $( children[i].elem ).empty();
            }
        }
    });

    define('AppResult', Binder, { 
        constructor: function () {
            Binder.apply( this, arguments );

            this.trackObject;

            on( this, 'click' );
        }
        , click: function() {
            //generate radio-playlist for the artist chosen
            this.context.context.Form._getPlaylistFromEchonest( this.trackObject );

            //hide and empty search results
            this.context.hide();
        }
        , update: function ( data ) {
            var filtered = {};

            //to use as seed for radio
            this.trackObject = data;

            //for presenting on screen
            filtered['Artist'] = data.artists[0].name;
            filtered['Track']  = data.name;
            filtered['Album']  = data.album.name;

            return Binder.prototype.update.call( this, filtered );
        }
    });

    define('AppSettings', Binder, { 
        constructor: function () {
            Binder.apply( this, arguments );

            on( this, 'submit' );

            this.autoload();
        }
        , autoload: function() {
            //auto-fill data with config values
            $(this.elem).find('input:radio').val(
                    [config.echonest.radioType, config.echonest.playlistType, config.echonest.distribution ]
                );

            $( this.elem ).find('input:checkbox').each(function() {
                var name  = $(this).attr('name');
                if( config.filters[ name ] )    
                    $(this).attr('checked','checked')
            });

            $(this.elem).find('[name="songNumber"]').val( config.playlist.songNumber );
            $(this.elem).find('[name="variety"]').val( config.echonest.variety );
        }
        , submit: function( event ) {
            if ( event )
                event.preventDefault();

            //get values from form
            var data = $( this.elem ).serializeArray();
            var structured = new Object();
            for( var i in data ) {
                structured[ data[i].name ] = data[i].value;
            }

            if( structured["radio-type"]) {
                config.echonest.radioType = structured["radio-type"];
            }
            if( structured["songNumber"] ) {
                var number = structured["songNumber"];
                if( number.match(/\d+/) )
                    config.playlist.songNumber = number;
            }

            if( structured["variety"] ) {
                var variety = structured["variety"];
                if( number.match(/[0-9]*\.?[0-9]+/) )
                    config.echonest.variety = variety;
            }

            if( structured["distribution"] ) {
                config.playlist.distribution = structured["distribution"];
            }
            
            //filters
            for( var name in config.filters ) {
                var value = config.filters[ name ];

                if( !value && structured[name] !== undefined )
                    config.filters[ name ] = 1;
                if( value && structured[name] === undefined )
                    config.filters[ name ] = 0;
            }

            //and set values in config
            localStorage.setItem( "config", JSON.stringify( config ) );

            //TODO: show message save completed
        }
    });

    define('AppResetSettings', AppButton, {
        click: function () { 
            config = jQuery.extend(true, {}, defaultConfig);
            localStorage.setItem( "config", JSON.stringify( config ) );

            //refresh settings form values
            this.context.Form.autoload();

            return false;
        }
    });

    define('AppHistoryContainer', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );

            //autoload its children and start slider
            this.context.History.autoload();

            var length = this.context.History.children().length;
            if( length )
                this.show();
            if( length > config.history.slider.minimum )
                this.context.History.start();
        }
    });


    define('AppHistory', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
        , autoload: function() {
            //auto-update slider from history
            if( config.filters.autoload && history.length ) {
                for ( var i = 0; i < history.length ; i++ ) {
                    var playlists = new Array();

                    var item = {};
                    item.seed     = history[i].seed;
                    item.playlist = listOfTracks2Playlist( history[i].playlist );
                    item.playing  = history[i].playing;

                    playlists.push( item );
                    this.update( playlists );
                }
            }
            this.root.history = history;
        }
        , update: function ( val ) {
            var obj = this;

            if ( Array.isArray( val ) ) {
                Array.prototype.forEach.call( val, function ( value, index ) {
                    var child = obj.attach( value.template || 0 );
                    if ( value !== void 0 ) {
                        delete value.template;
                        child.update( value );
                    }
                });

                this.start();
                return obj.children();
            }

            return Binder.prototype.update( obj, val );
        }
        , start: function() {
            //config
            this.step    = config.history.slider.step    || 1;
            this.minimum = config.history.slider.minimum || 8;

            this.$ = $( this.elem );

            if( !this.children().length || this.children().length <= this.minimum )
                return;

            // make container as large as the sum of all slides
            var elem = $( this.children()[0].elem );

            this.stepWidth = elem.outerWidth(true);

            this.$.css('width', (elem.outerWidth( true ) * this.children().length) + 'px');

            this.goTo(0);
        }
        , goTo: function( index ) {
            // filter invalid indices
            if ( index == this.currentIndex || !this.children().length )
                return;

            if (index < 0) {
                index = 0;
            }
            else if ( index > this.children().length - this.minimum ) {
                index = this.children().length - this.minimum;
            }

            if ( index == 0) {
                this.context.Previous.hide();
                this.context.Next.show();
            }
            else if ( index == this.children().length - this.minimum ) {
                this.context.Previous.show();
                this.context.Next.hide();
            }
            else {
                this.context.Previous.show();
                this.context.Next.show();
            }

            // move <ul> left
            this.$.css('left', '-' + (this.stepWidth * index) + 'px');
        
            this.currentIndex = index;
        }
        , previous: function() {
            this.goTo(this.currentIndex - this.step);
        }
        , next: function() {
            this.goTo(this.currentIndex + this.step);
        }
    });

    define('AppNext', AppButton, {
        click: function () { 
            this.context.History.next();

            return false;
        }
    });

    define('AppPrevious', AppButton, {
        click: function () { 
            this.context.History.previous();

            return false;
        }
    });

    define('AppSlide', AppPlayer, { 
        constructor: function () {
            Binder.apply( this, arguments );

            this.seed;
            this.playing;

            //instantiate spotify player with some options
            this.player = new views.Player();
            this.player.node.style.height = '100px';
            this.player.node.style.width = '100px';
            this.player.node.style.backgroundSize = 'cover';

            on( this, 'click' );
        }
        , update: function ( data ) {
            this.seed = data.seed;

            AppPlayer.prototype.update.call( this, data.playlist );

            //show history slider
            if( data )
                this.context.show();

            //set it as the now playing
            if( data.playing )
                this.click();
        }
        , click: function ( evt ) {
            var pl = this.player.context;

            //update current playing with the slide clicked
            this.context.context.Player.update( pl );
            this.context.context.Playlist.update( pl );
            this.context.context.seed = this.seed;
            this.context.context.Title.update( this.seed );

            //set in history, this one as the now playing
            for ( var i = 0; i < history.length ; i++ ) {
                if( this.seed.data.uri == history[i].seed.data.uri ) {
                    history[i].playing = 1;     
                }
            }
            localStorage.setItem( "history", JSON.stringify( history ) );
        }
        , delete: function () {
            //remove this item from config history
            for ( var i = 0; i < history.length ; i++ ) {
                if( this.seed.data.uri == history[i].seed.data.uri ) {
                    history.splice(i,1);
                }
            }
            localStorage.setItem( "history", JSON.stringify( history ) );

            //after removing all slides, hide history
            if( this.context.children().length == 1 )
                this.context.hide();

            //remove this slide from slider
            this.context.dettach( this );
        }
    });

})( Binder );
