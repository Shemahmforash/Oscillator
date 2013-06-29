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
    var config;
    if( localStorage.getItem("config") ) {
        config = JSON.parse( localStorage.getItem("config") );
    }
    else {
        //default config
        config = {
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
            history: [],
        };
    }

    /*TAB SWITCHING*/
    models.application.observe(models.EVENT.ARGUMENTSCHANGED, tabs);
    function tabs() {
        var args = models.application.arguments;

        var current  = document.getElementById(args[0]);
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
            var track_uri = tracks[i].tracks[0].foreign_id.replace('-WW', '');
            var track = models.Track.fromURI( track_uri );
            currentTracks.push( track );
            playlist.add( track );
        }

        return playlist;
    }

    define('AppForm', Binder, {
        constructor: function () {
            this.isContext = true;
            this.whoSubmitted = '';

            Binder.apply( this, arguments );

            on( this, 'submit');
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
            //TODO: show error message
            if( !seed ) 
                return;

            var request = {
                    format:'jsonp',
                    limit: true,
                    results: config.playlist.songNumber,
                    /*
                    artist-radio - plays songs for the given artists and similar artists
                    song-radio - plays songs similar to the song specified.
                    genre-radio - plays songs from artists matching the given genre
                    */
                    type: config.echonest.radioType,
                    bucket: ['id:spotify-WW', 'tracks']
                };
            //make echonest send spotify song ids
            if( config.echonest.radioType == 'artist-radio') {
                request.artist_id = seed.artists[0].uri.replace('spotify', 'spotify-WW');
            }
            else if( config.echonest.radioType == 'song-radio') {
                request.track_id = seed.uri.replace('spotify', 'spotify-WW');
            }

            var that = this;

            var url = 'http://developer.echonest.com/api/v4/playlist/' + config.echonest.playlistType + '?api_key=' + config.echonest.apiKey + '&callback=?';

             /* Set traditional mode in JS */
            $.ajaxSetup({traditional: true, cache: true});

            $.getJSON( url,  
                request
                , function ( data ) {
                    if ( that._checkResponse( data ) ) {
                        that.context.Player.seed = seed;
                        that.context.Player.update( data.response.songs );
                    }
                    else {
                        that.Error.update("trouble getting results");
                    }
                }
            );

        }
        , _checkResponse: function (data) {
            if ( data.response ) {
                if (data.response.status.code != 0) {
                    this.Error.update("Whoops... Unexpected error from server. " + data.response.status.message);
                } else {
                    return true;
                }
            } else {
                error("Unexpected response from server");
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
        }
      , click: function () {
            this.context.whoSubmitted = this.name;
        }
    });

    define('AppError', Binder, {
        constructor: function ( elem, parent, args ) {
            this.name = 'Error';
            this.delay = args.delay || 2000;
            Binder.apply( this, arguments );
        }
        , hide: function () {
            delete this.timeout;
            return Binder.prototype.hide.call( this );
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
        , update: function ( data ) {
            //this.Super.prototype.update.call( this, data );
            this.show();
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
            config.history.push( item2config );
            localStorage.setItem( "config", JSON.stringify( config ) );

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

            //update history
            var history = new Array();
            history.push( item2slider );
            this.History.update( history );
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
        }
        , submit: function( event ) {
            if ( event )
                event.preventDefault();

            //TODO: set config values from combos and input            

            localStorage.setItem( "config", JSON.stringify( config ) );
        }
    });

    define('AppHistory', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );

            //auto-update slider from history
            if( config.history.length ) {
                for ( var i = 0; i < config.history.length ; i++ ) {
                    var playlists = new Array();

                    var item = {};
                    item.seed     = config.history[i].seed;
                    item.playlist = listOfTracks2Playlist( config.history[i].playlist );
                    item.playing  = config.history[i].playing;

                    playlists.push( item );
                    this.update( playlists );
                }
                this.show();
            }
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

            //set in config history, this one as the now playing
            for ( var i = 0; i < config.history.length ; i++ ) {
                if( this.seed.data.uri == config.history[i].seed.data.uri ) {
                    config.history[i].playing = 1;     
                }
            }
            localStorage.setItem( "config", JSON.stringify( config ) );
        }
        , delete: function () {
            //remove this item from config history
            for ( var i = 0; i < config.history.length ; i++ ) {
                if( this.seed.data.uri == config.history[i].seed.data.uri ) {
                    config.history.splice(i,1);
                }
            }
            localStorage.setItem( "config", JSON.stringify( config ) );

            //after removing all slides, hide history
            if( this.context.children().length == 1 )
                this.context.hide();

            //remove this slide from slider
            this.context.dettach( this );
        }
    });

})( Binder );
