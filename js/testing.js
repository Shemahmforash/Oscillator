"use strict";
window.onload = function() {
    var sp = getSpotifyApi();
    var models = sp.require('$api/models');
    var views = sp.require('$api/views');

    var search = new models.Search('Povarovo');
    search.localResults = models.LOCALSEARCHRESULTS.APPEND;

    var searchHTML = document.getElementById('results');

    search.observe(models.EVENT.CHANGE, function() {
        var results = search.tracks;
        console.log( results );
        var fragment = document.createDocumentFragment();
        for (var i=0; i<results.length; i++){
            var link = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#';
            //results[i].uri;
            a['data-jsb-artist'] = results[i].artists[0];
            link.appendChild(a);
            a.innerHTML = results[i].name;
            
           /* var img = document.createElement('image');
            console.log( results[i].album );
            img.src = results[i].album.cover;

            link.appendChild( img );*/
            fragment.appendChild(link);
        }

        searchHTML.appendChild(fragment);
    });

    search.appendNext();    


    $("a").click(function(event) {
        event.preventDefault();

        console.log('clicked');
        console.log( this.href );
        console.log('artist');
        console.log( this['data-jsb-artist'] );

        var seed = this['data-jsb-artist'];
        var artist_id = seed.uri.replace('spotify', 'spotify-WW');

        console.log( artist_id );

        /* Set traditional mode in JS */
        //$.ajaxSetup({traditional: true, cache: true});

        var en_api_key = '2FOIUUMCRLFMAWJXT';

        getPlaylistFromEchoNest(en_api_key, artist_id);

        return false;

    });

    function getPlaylistFromEchoNest(api_key, artist_id) {
        var url = 'http://developer.echonest.com/api/v4/playlist/basic?api_key=' + api_key + '&callback=?';
        console.log(url);

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
            console.log(data);
            if (checkResponse(data)) {
                var playlist = new models.Playlist();
                for (var i=0;i<data.response.songs.length;i++) {
                    var track_uri = data.response.songs[i].tracks[0].foreign_id.replace('-WW', '');
                    var track = models.Track.fromURI(track_uri);
                    playlist.add(track);
                }

                makePlayerView(playlist);

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
        $('#player').append(player.node);
    }
};
