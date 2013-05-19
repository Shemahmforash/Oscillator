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
                playlistType: "basic",
                radioType: "artist-radio"
                /*
                artist-radio - plays songs for the given artists and similar artists
                song-radio - plays songs similar to the song specified.
                genre-radio - plays songs from artists matching the given genre
                */
            },
            playlist: {
               suffix: "#oscillator", 
               songNumber: 20
            },
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

            if( this.whoSubmitted === 'Random' ) {
                var max = models.library.tracks.length;
                if( max ) {
                    var random_number = Math.floor( Math.random() * max );
                    var seed = models.library.tracks[random_number].artists[0];

                    //get the playlist for the seed
                    this._getPlaylistFromEchonest( seed );
                }
                else {
                    var msg = "Your library is empty. Oscillator can not get a random song from your library... You should use the search songs feature instead.";
                    this.Error.update( msg );
                }
                
            }
            else {
                //search for artists
                var query = this.Query.elem.value;

                this._doSearch( query );
            }

            return false;
        },
        _getPlaylistFromEchonest: function( seed ) {
            if( !seed ) 
                return;

            //make echonest send spotify song ids
            var artist_id = seed.uri.replace('spotify', 'spotify-WW');
            var that = this;

            var url = 'http://developer.echonest.com/api/v4/playlist/basic?api_key=' + config.echonest.apiKey + '&callback=?';

             /* Set traditional mode in JS */
            $.ajaxSetup({traditional: true, cache: true});

            $.getJSON( url,  
                {
                    artist_id: artist_id,
                    format:'jsonp',
                    limit: true,
                    results: 20,
                    type:'artist-radio',
                    bucket: ['id:spotify-WW', 'tracks']
                    /*
                    artist-radio - plays songs for the given artists and similar artists
                    song-radio - plays songs similar to the song specified.
                    genre-radio - plays songs from artists matching the given genre
                    */
                }
                , function ( data ) {
                    if ( that._checkResponse( data ) ) {
                        that.context.Player.seed = seed;
                        that.context.Player.update( data );

                        that.context.Player.Title.value( config.echonest.radioType + ' for ' + seed.data.name );
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
            this.currentTracks = new Array();
        }
        , update: function ( data ) {
            var playlist = new models.Playlist();

            //empty current tracks
            this.currentTracks.length = 0; 

            //add tracks to the playlist obj and to the global array
            for ( var i=0; i < data.response.songs.length; i++ ) {
                var track_uri = data.response.songs[i].tracks[0].foreign_id.replace('-WW', '');
                var track = models.Track.fromURI(track_uri);
                playlist.add(track);
                this.currentTracks.push( track );
            }

            //update current player and playlist
            this.Player.update( playlist );
            this.Playlist.update( playlist );

            //update history
            var history = new Array();
            history.push( playlist );
            this.History.update( history );
        }
    });

    var AppPlayer = define('AppPlayer', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );

            //instantiate spotify player with some options
            this.player = new views.Player();
            this.player.node.style.height = '300px';
            this.player.node.style.width = '300px';
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
            for (var i = 0; i < this.context.currentTracks.length; i++) {
                thePlaylist.add( this.context.currentTracks[i] );
            }
            return false;
        }
    });

    define('AppResult', Binder, { 
        constructor: function () {
            Binder.apply( this, arguments );

            this.artistObject;

            on( this, 'click' );
        }
        , click: function() {
            //generate radio-playlist for the artist chosen
            this.context.context.Form._getPlaylistFromEchonest( this.artistObject );

            //hide and empty search results
            this.context.hide();
        }
        , update: function ( data ) {
            var filtered = {};

            //for presenting on screen
            filtered['Artist'] = data.artists[0].name;
            filtered['Track']  = data.name;
            filtered['Album']  = data.album.name;

            //to use as seed for radio
            this.artistObject = data.artists[0];

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

    define('AppSlide', AppPlayer, { 
        constructor: function () {
            Binder.apply( this, arguments );

            //instantiate spotify player with some options
            this.player = new views.Player();
            this.player.node.style.height = '100px';
            this.player.node.style.width = '100px';
            this.player.node.style.backgroundSize = 'cover';

            on( this, 'click' );
        }
        , click: function() {
            //update current playing with the slide clicked
            this.context.Player.update( this.player.context );
            this.context.Playlist.update( this.player.context );
        }
    });

})( Binder );
