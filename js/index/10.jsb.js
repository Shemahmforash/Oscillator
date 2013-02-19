/*
    JavaScript Binder
      Bind HTML Elemts with JavsScript Objects for easy access and code reuse
  
    USAGE
    
      <div data-jsb-class="JsB" data-jsb-type="context" 
        data-jsb-name="master">
          <img src="/image.jpg" data-jsb-class="JsB" data-jsb-name="image">
          <ul data-jsb-class="JsB" data-jsb-type="multiple" 
            data-jsb-name="list">
              <li data-jsb-class="JsB">One</li>
              <li data-jsb-class="JsB">Two</li>
          </ul>
      </div>
      ...
      <script src="jsb.js"></script>
      
      <script type="text/javascript">
          JsB.APP_LANG = 'pt'
          var app = new JsB( document.body );
      </script>
      ...
      app.$master.$list[0].select();
  

    PARAMETERS
  
      data-jsb-class  the object's class to bind to the element
      data-jsb-type   the object's type. can be one of:
                        appender     TODO
                        context      defines this object as the main context
                        multiple     object allows multiple children 
                                       selected
                        reseter      TODO
                        transparent  object's children will be attached to
                                       his parent and will not appear in the 
                                       application's tree
      data-jsb-name   the object's name in the application's tree
      data-jsb-json   TODO
      data-jsb-clone  TODO
  

    FUNCTIONS 
  
      $( elem )
        Defines the support framework's object

        PARAMETERS
          elem  an HTMLEleent. If a support framework object is given returns
                 the same object untouched

        OVERRIDE
          This function can be overriden to use a differente supoort 
          framework, like jPure:

            JsB.$ = function ( elem ) { return new jPure( elem ) } ;

        RETURNS
          suport framework's object (default: jQuery)

        byClass     TODO
        byGuid      TODO      

      object( name[, object] )
        Acess/define JsB objects

        PARAMETERS
          name      the name of the object. For Application objects use App 
                      prefix
          object    if given, defines the object

        RETURNS
          A JsB object
  

    METHODS

      attach( elem[, name] )
        add an element as a child to object 
        
        PARAMETERS
          elem      the element to attach. can be one of:
                      HTMLElement
                      Jsb.$
          name      if given, overrides the default name logic

        RETURNS 
          a JsB object


      bind( eventName[, function] )
        bind an event to object's element

        PARAMETERS
          eventName     the event's name
          function      if given, the function to be executed. If not, 
                          executes the corresponding object's method

        RETURNS
          nothing


      clone()
        clones the object

        RETURNS
          a cloned version od the object


      data()
        TODO


      deselect( [ boolean | index | object | name ] )
        remove selection mark from object

        PARAMETERS
          none      deselects himself
          boolean   if true, deselects all children
          index     if given, deselects a child by array position
          object    if given, deselects a child that matches object 
          name      if given, deselects a child by name

        RETURNS
          the object or the last child deselected


      dettach
      empty
      hide
      load
      next
      previous
      select
      selected
      show
      toggle
      unbind
      update
      value

 */
(function ( window ) {
    var 
        Base = my.Class({
            'attach': function ( elem, index ) {
                if ( index !== undefined ) {
                    mSplice.call( this, index, 0, elem );
                    return elem;
                }
                else {
                    return mPush.call( this, elem );
                }
            }
            , 'dettach': function ( elem ) {
                if ( elem === undefined )
                    return mPop.call( this );

                var index = mIndexOf.call( this, elem );
                if ( index !== undefined )
                    return mSplice.call( this, index, 1 ).pop();
            }
            , 'toArray': function () { 
                return mSlice.call( this );
            }
            , 'length': 0
        })
        , Template = my.Class( Base, {
            'constructor': function ( caller ) {
                this.parent = caller;
                
                return Template.Super.call( this );
            }
            , 'attach': function ( elem ) {
                var $ = new JsB.$( elem );
                $.removeClass( 'template' );

                //remove object from the DOM
                $.remove();

                var clone = $.attr('data-jsb-clone');
                if ( clone ) {
                    var object = mPath2Child.call( this, clone );
                    
                    elem = object.clone();
                    
                    $ = new JsB.$( elem );
                }

                var name = fn$Name( $ );
                if ( name !== undefined )
                    this[ '$' + name ] = $;

                return Template.Super.prototype.attach.call( this, $ );
            }
            , 'dettach': function ( elem ) { 
                var $ = Template.Super.prototype.dettach.call( this, elem );

                if ( $ === undefined )
                    return;

                var name = fn$Name( $ );

                $.remove();

                if ( name !== undefined ) {
                    var $name = '$' + name;
                    delete this[ $name ];
                }

                $ = null;
            }
            , 'destructor': function () {
                while ( this.length )
                    this.dettach(); 

                this.parent = null;
            }
        })
        var Queue = my.Class({
            'push': function ( elem ) { 
                return mPush.call( this, elem );
            }
            , 'execute': function () { 
                while ( queued = mShift.call( this ) ) {
                    switch ( typeof queued ) {
                        case "function":
                            queued();
                            break;
                        default:
                    }
                }
            }
            , 'length': 0
        })
        , jsbObject  = {}
        , jsbByGuid  = []
        , jsbByClass = {}
        , JsB = my.Class( Base, {
            'STATIC': {
                '$': function ( elem ) { 
                    return new jQuery( elem ) 
                }
                , 'byGuid': function ( guid ) {
                    if ( guid === undefined )
                        return false;

                    return jsbByGuid[ guid ];
                }
                , 'byClass': function ( className ) {
                    if ( className === undefined )
                        return [];

                    var array = jsbByClass[ className ] || [];

                    return array.slice(0)
                }
                , 'object': function ( className, object ) {
                    if ( ! className )
                        return false;

                    if ( className === 'JsB' )
                        return JsB;

                    if ( typeof object === 'function' && object.constructor )
                        jsbObject[ className ] = object;

                    return jsbObject[ className ];
                }
            }
            , 'constructor': function ( elem, caller ) {
                this.caller = caller;
                this.$      = JsB.$( elem );

                mType.call( this );   // add isType properties
                mParent.call( this ); // define's root context and parent

                this.template = new Template( this );
                this.queue    = new Queue( this );

                mChildren.call( this, this.$ )

                this.queue.execute()

                // delete unecessary methods
                if ( ! this.template.length ) // no templates, no method
                    delete this.template

                delete this.queue

                this.select.toggle   = mToggleSelect; 
                this.deselect.toggle = mToggleSelect; 

                return true
            }
            , 'attach': function ( elem, name, index ) {
                var $ = new JsB.$( elem );

                if ( $.hasClass( 'template') )
                    return this.template.attach( $ );
                
                var clone = $.attr('data-jsb-clone');
                if ( clone ) {
                    var object = mPath2Child.call( this, clone );
                    
                    elem = object.clone();
                    $.remove();
                    
                    $ = new JsB.$( elem );
                    this.$.append( $ ); 
                }

                var jsbClass = $.attr('data-jsb-class') || 'JsB';

                var constructor = JsB.object( jsbClass ) ;
                if ( constructor == undefined ) {
                    throw 'Class "' + jsbClass + '" not found!';
                    return;
                }
                var object = new constructor( $, this );

                if ( !( object instanceof JsB ) )
                    return null;

                if ( object.name === undefined )
                    object.name  = name || fn$Name( $ );

                object.className = jsbClass;
                
                // Guid
                object.guid = jsbByGuid.length;
                jsbByGuid.push( object );

                // Group this object with others with the same class
                if ( jsbByClass[ jsbClass ] === undefined )
                    jsbByClass[ jsbClass ] = []

                jsbByClass[ jsbClass ].push( object );

                if ( ! object.isTransparent ) {
                    if ( object.name !== undefined )
                        object.parent[ '$' + object.name ] = object;

                    JsB.Super.prototype.attach.call( object.parent, object, index );
                }

                return object;
            }
            , 'bind': function ( eventName, fn ) {
                fn = fn || this[ eventName ];
                var that = this;
                this.$.bind( eventName, function( event, args ) {
                    return fn.call( that, event, args );
                });
            }
            , 'clone': function () {
                var clonedElem  = this.$.clone();
                
                return new this.constructor( clonedElem, this.caller );
            }
            // TODO REWRITE DATA
            /*, 'data': function ( item ) { 
                var attrs = this.$[0].attributes;
                var data  = {};

                for ( var key in attrs ) {
                    if ( typeof( attrs[ key ].name ) === "undefined" )
                        continue;

                    var name = attrs[ key ].name;
                    if ( name.match(/^data\-/i) ) {
                        name = name.replace(/^data\-/i, '');
                        data[ name ] = attrs[ key ].value;
                    }   
                }   
                
                return ( item ) ? data[ item ] : data;
            }*/
            , 'deselect': function ( child ) { 
                switch ( child ) {
                    case false:
                    case undefined:
                        this.$.removeClass( 'selected' );
                        return this;
                    case true:
                        children = this.selected( true );

                        while ( child = children.shift() )
                            child.deselect();

                        return child; // TODO: maybe not the better solution...
                    default:
                        child = mGetChild.call( this, child );

                        if ( child !== false )
                            return child.deselect();

                        return child;
                }
            }
            , 'destructor': function () {
                // dettach childs first
                while ( this.length )
                    this.dettach();

                // jsbByGuid
                var guidIndex = mIndexOf.call( jsbByGuid, this );
                if ( guidIndex >= 0 ) {
                    jsbByGuid[ guidIndex ] = null;
                    jsbByGuid.splice( guidIndex, 1 );
                }

                var classSiblings = jsbByClass[ this.className ];
                var classIndex    = mIndexOf.call( classSiblings, this );
                if ( classIndex >= 0 ) {
                    classSiblings[ classIndex ] = null;
                    classSiblings.splice( classIndex, 1 );
                }

                //remove this from the dom
                this.$.remove();
                this.$ = null;

                this.caller  = null;
                this.context = null;
                this.parent  = null;
                this.root    = null;

                var template = this.template;
                if ( template ) {
                    template.destructor();
                }

                this.template = null;
            }
            , 'dettach': function ( elem ) {
                var object = JsB.Super.prototype.dettach.call( this, elem );

                if ( object === undefined )
                    return;

                if ( object.name !== undefined )
                    delete this[ '$' + object.name ];

                object.destructor();
                object = null;
            }
            , 'empty': function () {
                while ( this.length )
                    this.dettach();

                this.value( null );
                return this;
            }
            , 'hide': function ( child ) { 
                this.$.hide();
                //this.$.addClass( 'hidden' );
                return this;
            }
            , 'hidden': function ( child ) {
                return this.$.hasClass( 'hidden' );
            }
            , 'load': function ( scripts, callback ) {
                /*
                * TODO: to be check by abras
                */
                //set counter to zero
                var js_load_count = 0;
                
                var load_handler = function (ev) {
                    js_load_count += 1;
                    
                    //if we finished loading all dependencies call the callback function.
                    if( js_load_count == scripts.length && typeof(callback) == 'function') {
                        callback();
                    }
                    
                    //remove event handler, not needed anymore
                    ev.target.removeEventListener('load', load_handler);
                }

                //for each dependencie
                for ( var idx in scripts ) {
                    var script_url = scripts[idx];
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = script_url;
                    
                    //onload event handler
                    script.addEventListener('load', load_handler);

                    //append to the document body
                    document.body.appendChild(script);
                }
            }
            , 'next': function ( child ) { 
                return mNext.call( this, child );
            }
            , 'previous': function ( child ) { 
                return mNext.call( this, child, true );
            }
            , 'select': function ( child ) {
               switch ( child ) {
                    case false:
                    case undefined:
                        var parent = this.parent;
                        if ( parent !== undefined && !( parent.isMultiple ) )
                            parent.deselect( true );
                   
                        this.$.addClass( 'selected' );
                        return this;
                    case true:
                        children = this.toArray();

                        while ( child = children.shift() )
                            child.select();

                        return child; // TODO: maybe not the better solution...
                    default:
                        child = mGetChild.call( this, child );

                        if ( child !== false )
                            return child.select();

                        return child;
                }
            }
            , 'selected': function ( child ) {
                if ( child === true )
                    return mFilter.call( 
                            this, function (v) { return v.selected() } 
                        );
                
                return this.$.hasClass( 'selected' );
            }
            , 'show': function () { 
                this.$.show();
                // this.$.removeClass( 'hidden' );
                return this;
            }
            , 'swap': function ( child1, child2 ) {
                var index1 = mIndexOf.call( this, child1 )
                  , index2 = mIndexOf.call( this, child2 )
                  ;

                if ( ( index1 > -1 ) && ( index2 > -1 ) ) {
                    this[ index1 ] = mSplice.call( this, index2, 1, this[ index1 ] ).pop();

                    var a = child1.$[0];
                    var b = child2.$[0];
                    var t = a.parentNode.insertBefore(document.createTextNode(''), a);

                    b.parentNode.insertBefore(a, b);
                    t.parentNode.insertBefore(b, t);
                    t.parentNode.removeChild(t);

                    return [ index1, index2 ];
                }
                                                                            
                return false;
            }
            , 'toggle': function ( fnName1, fnName2 ) {
                var fn
                  , fnName
                  , fn1 = this[ fnName1 ]
                  , fn2 = this[ fnName2 ]
                    ;

                if ( typeof fn1 !== 'function' )
                    return false;

                // Check if method as a toggle hook and execute it
                if ( arguments.length === 1 && fn1.hasOwnProperty('toggle') )
                    return fn1.toggle.call( this )

                if ( typeof fn2 !== 'function' )
                    return false;

                var flagName = [ '', 'toggle', fnName1, fnName2 ].join('_')
                  , flag     = this[ flagName ] = !( this[ flagName ] )
                  ;

                if ( flag === true )
                    fn = fn1, fnName = fnName1;
                else
                    fn = fn2, fnName = fnName2;

                fn.call( this );

                return fnName;
            }
            , 'unbind': function ( ev ) {
                this.$.unbind( ev );
            }
            , 'update': function ( data ) {
                if ( data instanceof Array ) {
                    if ( this.isReseter )
                        this.empty();

                    for ( var idx = 0; idx < data.length; idx++ ) {
                        var value    = data[ idx ]
                          , template = value.template || 0
                          , name     = value.name
                          , child
                          ;

                        delete value.template;
                        delete value.name;

                        if ( !this.isAppender && this.hasOwnProperty( idx ) )
                            child = this[ idx ]
                        else {
                            var elem = this.template[ template ].clone();
                            child = this.attach( elem, name )
                            this.$.append( child.$ );
                        }

                        child.update( value );
                    }
                } 
                else if ( data instanceof Object ) {
                    for ( var key in data ) {
                        var value = data[ key ];
                        var child = this[ key ];

                        var path = key.match(/^([^\.]+)\.(.+)$/);
                        if ( path !== null ) {
                            key   = path[1];
                            child = this[ path[1] ];

                            var object = {};
                            object[ path[2] ] = value;
                            value = object;
                        }
                        
                        if ( child instanceof Function ) {
                            child.call( this, value );
                        } else if ( this.hasOwnProperty( key ) )
                            if ( child instanceof JsB )
                                child.update( value );
                            else
                                this[ key ] = value;
                        else //it's a dom node attribute
                            this.$.attr(key, value);
                    }
                }
                else {
                    this.value( data );
                }
            }
            , 'value': function ( value ) {
                return this.$.html( value )
            }
        })
        , arrayProto = Array.prototype
        , fn$Name   = function ( $ ) {
            return $.attr('data-jsb-name') || $.attr('id') || $.attr('name');
        }
        , mFilter   = arrayProto.filter
        , mIndexOf  = arrayProto.indexOf
        , mPop      = arrayProto.pop
        , mPush     = arrayProto.push
        , mShift    = arrayProto.shift
        , mSlice    = arrayProto.slice
        , mSplice   = arrayProto.splice
        , mToString = arrayProto.toString
        , mUcFirst  = function () {
            return this.replace( /^[a-z]/, function ( v ) { return v.toUpperCase() } );
        }
        , mChildren = function ( $ ) {
            var children = mSlice.call( $.children(), 0 );

            while ( child = children.shift() ) {
                var $child = JsB.$( child );
                if ( $child.attr('data-jsb-class') )
                    this.attach( $child );
                else 
                    mChildren.call( this, $child );
            }
        }
        , mContext = function () {
            var caller = this.caller;
            
            if ( typeof caller === 'object' )
                return caller.isContext ? caller : caller.context;

            return this;
        }
        , mGetChild = function ( child ) {
            switch ( typeof child ) {
                case "string":
                case "number":
                    if ( ! this.hasOwnProperty( child ) )
                        return false;

                    return this[ child ];
                case "object":
                    if ( mIndexOf.call( this, child ) < 0 )
                        return false;

                    return child;
                default:
                    return false;
            }
        }
        , mNext = function ( child, reverse ) {

            if ( ! child ) {
                var parent = this.parent;
                child      = this;
                
                if ( ! parent ) // for root
                    parent = this
                  , child = true;

                return mNext.call( parent, child, reverse );
            }

            var length = this.length
              , method   = 'pop'
              , check    = length - 1
              , value    = 1
              , fallback = 0
              ;
            
            if ( reverse === true ) {
                method   = 'shift'
              , check    = 0
              , value    = -1
              , fallback = length - 1
              ;
            }

            if ( child === true ) {
                switch ( length ) {
                    case 0:
                        return false;
                    case 1:
                        child = this[ 0 ];
                        return child.selected() ? false : child ;
                }

                var selected = this.selected( true );

                if ( selected.length === 0 )
                    return this[ fallback ]

                child = selected[ method ]();
            }

            var index = mIndexOf.call( this, child );
            if ( index === check )
                return false;

            return this[ index + value ];
        }
        , mParent = function () {
            this.root    = mRoot.call( this );
            this.context = mContext.call( this );
            
            var root = this.caller;
            while ( typeof root === 'object' && root.isTransparent ) {
                root = root.parent;
            }
             
            this.parent = root;
        }
        , mPath2Child = function ( path ) {
            if ( ! path )
                return false;
                    
            path = path.split(/\./);
            var object = this;

            var child;
            while ( child = path.shift() ) {
                if ( ! object.hasOwnProperty( child ) )
                    return false;
                
                object = object[ child ];
            }

            return object;
        }
        , mRoot = function () {
            var caller = this.caller;

            if ( typeof caller === 'object' ) 
                return caller.root || caller;

            return this;
        }
        , mToggleSelect = function () {
            var action = this.selected() ? 'deselect' : 'select'; 
            this[ action ]();
            return action;
        }
        , mType  = function () {
            var type = this.$.attr('data-jsb-type');

            if ( type === undefined )
                return false;

            var types = type.split(' ');;
            while ( type = types.shift() ) {
                var isVar = 'is' + mUcFirst.call( type );
                this[ isVar ] = true;
            }

            return true;
        }
    ;

    window.JsB = JsB;
})( window );
