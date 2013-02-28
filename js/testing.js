"use strict";
window.onload = function() {
    var sp = getSpotifyApi();
    var models = sp.require('$api/models');
    var views = sp.require('$api/views');


    $('#next').click(function(){
        models.player.next();
        return false;
    });

    $('#previous').click(function(){
        models.player.previous();
        return false;
    });

    /*$('#search').click( function() {
        var query = $('#query').val();

        doSearch( query );
    });*/

    $('#search').submit( function( event ) {
        event.preventDefault();

        var query = $('#query').val();

        console.log("subit form, searching for " + query);

        doSearch( query );
    });


    $("#results").on( "click", "a", function(event) {
        event.preventDefault();

        var seed = this['data-jsb-artist'];
        var artist_id = seed.uri.replace('spotify', 'spotify-WW');

        /* Set traditional mode in JS */
        //$.ajaxSetup({traditional: true, cache: true});

        var echonestApiKey = '2FOIUUMCRLFMAWJXT';

        getPlaylistFromEchoNest(echonestApiKey, artist_id);

        $('#msg').text("Radio-playlist based on " + seed );

        $('#results').hide();

        return false;

    });

    function getPlaylistFromEchoNest(api_key, artist_id) {
        var url = 'http://developer.echonest.com/api/v4/playlist/basic?api_key=' + api_key + '&callback=?';

        /* Set traditional mode in JS */
        $.ajaxSetup({traditional: true, cache: true});

        $.getJSON(url,
            {
                artist_id: artist_id,
                format:'jsonp',
                limit: true,
                results: 50,
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
                for (var i=0;i<data.response.songs.length;i++) {
                    var track_uri = data.response.songs[i].tracks[0].foreign_id.replace('-WW', '');
                    var track = models.Track.fromURI(track_uri);
                    playlist.add(track);
                }

                makePlayerView( playlist );

                $('#controls').show();

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
