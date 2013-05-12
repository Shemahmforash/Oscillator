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
        this.config = {
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

            console.log( "form submitted ");
            console.log("whosubmitted: " + this.whoSubmitted );

            if( this.whoSubmitted === 'Random' ) {
                var max = models.library.tracks.length;
                if( max ) {
                    var random_number = Math.floor( Math.random() * max );
                    var seed = models.library.tracks[random_number].artists[0];

                    console.log("seed:");
                    console.log( seed );

                    //get the playlist for the seed
                    this._getPlaylistFromEchonest( seed );
                }
                else {
                    var msg = "Your library is empty. Oscillator can not get a random song from your library... Try to search for songs.";
                    this.Error.update( msg );
                }
                
            }
            else {
                //search for artists
                var query = this.Query.elem.value;

                console.log( "query" );
                console.log( query );

                //TODO: do the search on spotify
            }

            return false;
        },
        _getPlaylistFromEchonest: function( seed ) {
            //with this echonests sends spotify song ids
            var artist_id = seed.uri.replace('spotify', 'spotify-WW');
            var that = this;
            console.log("key");
            console.log( config.echonest.apiKey );

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
            AppError.Super.prototype.update.call( this, data );
            this.show();
        }
    });

    define('AppController', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
            this.currentTracks = new Array();
        }
        , update: function ( data ) {
            
            console.log( "data" );
            console.log( data );

            console.log( "seed" );
            console.log( this.seed );

        }
    });

    define('AppPlayer', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
    });

    define('AppPlaylist', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
    });

    define('AppSavePlaylist', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
    });

    /*saves the generated by oscillator*/
    define('AppSavePlaylist', AppButton, {
        click: function () { 
            var title = config.echonest.radioType + " for " + this.context.seed;

            if( config.playlist.suffix ) {
                title = title + " - " + config.playlist.suffix;
            }

            var thePlaylist = new models.Playlist(title);
            for (var i = 0; i < this.context.currentTracks.length; i++) {
                thePlaylist.add( this.context.currentTracks[i] );
            }            
            return false;
        }
    });

    define('AppResults', Binder, {
        constructor: function () {
            Binder.apply( this, arguments );
        }
    });

    define('AppItem', Binder, {             
        constructor: function () {
            this.isContext = true;
            this.group     = 'items';
            Binder.apply( this, arguments );
        }
    });

})( Binder );
