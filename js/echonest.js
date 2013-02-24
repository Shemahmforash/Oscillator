$(document).ready(function() {
    /* Instantiate the global sp object; include models & views */
    var sp = getSpotifyApi();
    var models = sp.require('$api/models');
    var views = sp.require('$api/views');

    /* Set traditional mode in JS */
    $.ajaxSetup({traditional: true, cache: true});

    var en_api_key = '2FOIUUMCRLFMAWJXT';

    var random_number = Math.floor(Math.random()*51);

    /* Get the seed song. If the player is playing, use that
        * artist.
        * TODO: If no song is playing, grab the user's top
        * artist. */
    if (models.player.playing == true) {
        var seed = models.player.track.artists[0];
    } else {
        var seed = models.library.tracks[random_number].artists[0];
        console.log(seed.name);
    }

    //TODO: radio based on song or based on artist (option to start both)
    var artist_id = seed.uri.replace('spotify', 'spotify-WW');

    getPlaylistFromEchoNest(en_api_key, artist_id);

    function getPlaylistFromEchoNest(api_key, artist_id) {
        var url = 'http://developer.echonest.com/api/v4/playlist/basic?api_key=' + api_key + '&callback=?';
        console.log(url);
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

    $('#next').click(function(){
        models.player.next();
        console.log('play next song');
        return false;
    });

    $('#previous').click(function(){
        models.player.previous();
        console.log('play previous song');
        return false;
    });

    models.player.observe(models.EVENT.CHANGE, function(event) {
        console.log(event.data);
        /*
        if (event.data.curtrack) {
            var t = setTimeout(function() {
                models.player.next();
            }, 15000);
            console.log('track advanced');
        }
        
        $('#like').click(function(){
            clearTimeout(t);
            $('#msg').text('Let\'s keep listening!');
            console.log('the song will continue');
        });
        */
    });

});
