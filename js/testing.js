"use strict";
window.onload = function() {
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

    // a global array that will contain the current tracks in the player
    var currentTracks = new Array();
    var globalSeed;

    //TABS
    //tabs();                                                         
    models.application.observe(models.EVENT.ARGUMENTSCHANGED, tabs);

    function tabs() {
        var args = models.application.arguments;
        var current = document.getElementById(args[0]);
        var sections = document.getElementsByClassName('tabs');
        for (var i=0, l = sections.length; i<l; i++){
            if (current != sections[i]) {
                sections[i].style.display = 'none';
            }
        }
        current.style.display = 'block';
    }

    $('#next').click(function(){
        models.player.next();
        return false;
    });

    $('#previous').click(function(){
        models.player.previous();
        return false;
    });

    $('#savePlaylist').click(function(){
        var title = config.echonest.radioType + " for " + globalSeed;
        if( config.playlist.suffix ) {
            title = title + " - " + config.playlist.suffix;     
        }

        var thePlaylist = new models.Playlist(title);

        for (var i = 0; i < currentTracks.length; i++) {
            thePlaylist.add(currentTracks[i]);
        }
    });

    var $form = $( '#search' );
    var $submitBtns = $form.find( 'button' );
    var whoSubmitted;

    $submitBtns.click( function( event ) {
        whoSubmitted = this;
    });

    $('#search').submit( function( event ) {
        event.preventDefault();

        //random song or do search by query
        if( whoSubmitted.name == 'random' ) {
            //find a random song from the user's library
            var max = models.library.tracks.length;
            if( max ) {
                var random_number = Math.floor( Math.random() * max );
                var seed = models.library.tracks[random_number].artists[0];

                getPlaylistFromEchoNest(config.echonest.apiKey, seed );
            }
            else {
                var msg = "Your library is empty. Oscillator can not get a random song from your library... Try to search for songs.";
                $('#msg').text( msg );
            }

            $('#results').hide();
        }
        else {
            var query = $('#query').val();

            doSearch( query );
        }
    });

    $('#settings').submit( function( event ) {
        event.preventDefault();
        //TODO: set config values from combos and input
        localStorage.setItem( "config", JSON.stringify( config ) );
    });


    $("#results").on( "click", "a", function(event) {
        event.preventDefault();

        var seed = this['data-jsb-artist'];

        getPlaylistFromEchoNest(config.echonest.apiKey, seed);


        return false;

    });
    
    function getPlaylistFromEchoNest( api_key, artist ) {
        var artist_id = artist.uri.replace('spotify', 'spotify-WW');

        globalSeed = artist;

        var url = 'http://developer.echonest.com/api/v4/playlist/basic?api_key=' + api_key + '&callback=?';

        /* Set traditional mode in JS */
        $.ajaxSetup({traditional: true, cache: true});

        $.getJSON(url,
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
            },
        function(data) {
            if (checkResponse(data)) {
                var playlist = new models.Playlist();

                //empty current tracks
                currentTracks.length = 0;

                //add tracks to the playlist obj and to the global array
                for (var i=0;i<data.response.songs.length;i++) {
                    var track_uri = data.response.songs[i].tracks[0].foreign_id.replace('-WW', '');
                    var track = models.Track.fromURI(track_uri);
                    playlist.add(track);
                    currentTracks.push( track );
                }

                makePlayerView( playlist );
                showPlaylist( playlist );

                $('#controls').show();
                $('#error').text('');
                $('#results').hide();

                var msg = config.echonest.radioType + " for " + artist;
                $('#msg').text( msg );

            } else {
                $('#error').text("trouble getting results");
            }
        });
    }

    function checkResponse(data) {
        if (data.response) {
            if (data.response.status.code != 0) {
                $('#error').text("Whoops... Unexpected error from server. " + data.response.status.message);
                console.log(JSON.stringify(data.response));
            } else {
                return true;
            }
        } else {
            error("Unexpected response from server");
        }
        return false;
    }

    function showPlaylist( playlist ) {
        var list = new views.List( playlist ); 
   
        //empty and add list view for the player
        $('#playlist').empty().append( list.node );
    }

    function makePlayerView(uri) {
        var player = new views.Player();
        player.track = null;
        player.context = uri;
        player.node.style.height = '300px';
        player.node.style.width = '300px';
        player.node.style.backgroundSize = 'cover';

        //delete current contents and add player to DOM
        $('#player').empty().append(player.node);
    }

    function doSearch( query ) {
        var search = new models.Search( query );
        search.localResults = models.LOCALSEARCHRESULTS.APPEND;

        var searchHTML = document.getElementById( 'results' );
        //empty previous search results
        while( searchHTML.firstChild) { 
            searchHTML.removeChild( searchHTML.firstChild );
        } 

        search.observe(models.EVENT.CHANGE, function() {
            var results = search.tracks;

            var frag = document.createDocumentFragment();

            /*Default thead*/
            var thead =  document.createElement('thead');
            var row  = document.createElement('tr');
            var td  = document.createElement('td');
            td.innerHTML = "Songs";
            thead.appendChild( row );
            row.appendChild( td );
            searchHTML.appendChild( frag );

            var fragment = document.createDocumentFragment();
            for( var i=0; i < results.length; i++){
                var link_row = document.createElement('tr');
                var link     = document.createElement('td');
                var a        = document.createElement('a');

                a.href = '#';
                //results[i].uri;
                a['data-jsb-artist'] = results[i].artists[0];
                link_row.appendChild(link);
                link.appendChild(a);
                a.innerHTML = results[i].artists[0] + ' - ' + results[i].name;

            /* var img = document.createElement('image');
                console.log( results[i].album );
                img.src = results[i].album.cover;

                link.appendChild( img );*/

                fragment.appendChild(link_row);
            }

            searchHTML.appendChild(fragment);
        });

        search.appendNext();    

        $('#results').show();

    }
};
