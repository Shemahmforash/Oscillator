"use strict";
window.onload = function() {
    var sp = getSpotifyApi();
    var models = sp.require('$api/models');

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
            a.href = results[i].uri;
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

};
