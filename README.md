# Introduction

Charlotte is a framework for building mobile hybrid web/native apps using
[Express](http://expressjs.com/) and [PhoneGap](http://phonegap.com/). It
allows you to build a web app using a traditional web development approach and
then to reuse that web app and progressively enhance it for a native app.

By extending Express to the web browser Charlotte allows the rendering of view
templates to transparently move to the client where it can be combined with
CSS3 animations to provide page transitions with native feel. It leverages the
PhoneGap File API to provide reliable and granular control over the caching of
application assets and data on the device.

Charlotte provides a browser abstraction in JS that effectively produces,
within the single-page application environment of PhoneGap, a multi-page web
application development environment with user-defined page transition
animations, robust error handling, and the performance characteristics
(minimal network overhead) of an architecture based on a JavaScript MVC
framework and JSON server API.

(Charlotte is not a JavaScript MVC framework, though, and does not require you
to build an API.)

Charlotte is an implementation of the [*html bundle*][html_bundles] concept.
Read the wiki doc for some background.

Also, check out the [charlotte demo][demo] app.

# Requirements

* underscore >=1.3.1
 
* async >=0.1.16

* Express ~2.5.6

* zepto >=1.0rc1

* PhoneGap >=1.5.0

* jade (optional)

# Express Setup

Install charlotte:

    npm install charlotte
    
Require charlotte:

    var charlotte = require('charlotte');
    
Set a version:

    charlotte.version = "1.0";

Support express (do this just before you use the router middleware):

    charlotte.supportExpress(app);
    app.use(app.router);
    
Serve up views statically:

    app.use(express.static(__dirname + '/views'));

Use the `charlotte.byPassViews` route middleware in routes:

    var bypassViews = process.env.NODE_ENV == 'development' ? 
                        charlotte.bypassViews() : function(req, res, next) { next(); };

    app.get('/', bypassViews, function(req, res) {
    ...


The above assumes that we don't need to worry about bypassing views in
non-development environments as static asset files will be served out of a
different server.

Create a symlink to the charlotte module's lib directory somewhere in your
views directory:

    [~/projects/foo/node/views/lib]$ ln -s ../../node_modules/charlotte/lib charlotte

Create a `versions` directory in the `views` directory. Create a symlink
within the versions directory that points to the views directory above it for
each new version of your app :

    [~/projects/foo/node/views]$ mkdir versions
    [~/projects/foo/node/views]$ cd versions
    [~/projects/foo/node/views/versions]$ ln -s .. 1.0

# Layout Structure

Create a layout template and a layout body partial, which gets included by the layout:

layout.jade:

    !!! 5
    html(xmlns="http://www.w3.org/1999/xhtml")
      head
        meta(name="viewport", content="user-scalable=no, width=device-width")
        meta(name="apple-touch-fullscreen", content="yes")
        meta(name="apple-mobile-web-app-status-bar-style", content="black")
        - if (!requestId)
          != stylesheets('foo')
        != javascripts("/lib/underscore", "/lib/async", "/lib/zepto", "/lib/jade")
        != javascripts("/lib/charlotte/shared", "/lib/charlotte/charlotte", "/lib/charlotte/util")
        script(type="text/javascript")
          charlotte.baseUrl = 'http://foo.com/';
          charlotte.assetRootUrl = '#{assetRootUrl}';
          charlotte.version = '#{version}';
      
      body
        #content.content-container
          - if (isBlank("layoutBody"))
            !=partial('layout_body')
          - else if (layoutBody)
            !=partial(layoutBody)
          - else
            != body

layout_body.jade:

    - if (!requestId)
      != stylesheets('foo')

    != body

This layout body is rather empty but the bulk of the layout content for your
pages should go in the layout body partial, which should also include the body
of the response. The outer layout template should just be a basic html
skeleton with a content container that includes the layout body partial. It
should include charlotte and its dependencies.

The actual layout body partial to use should be given in the `layoutBody`
parameter, and should default to `layout_body`; if not blank (`undefined`,
`null`, or '') and not truthy we just include the body of the response
directly rather than go through the layout body.

Use the `javascripts()` and `stylesheets()` helper functions provided by
Charlotte to include JavaScript and CSS files. Simply pass paths to source
files to the functions (you can omit the '.js' and '.css' extensions) and they
will output script tags or link tags, respectively.

Note that the inclusion of the `stylesheets` partial is either in the outer
layout template or in the inner layout body depending on the presence of a
`requestId`.

The outer layout partial will only be used when rendering templates on the
server in node. We do some basic client-side charlotte setup in it, setting
the `baseUrl`, `assetUrl`, and `version` attributes on the global charlotte
object. When running in [*html bundle*][html_bundles] mode and rendering
templates on the client, the `baseUrl` and `assetUrl` attributes will be set
by the bootstrap process , which you can see in the **Client `window` setup**
section of this document, and the version will be handled in a different
manner.

# Client `window` Setup

Include charlotte and its dependencies in your `index.html` file to bootstrap
charlotte. Also include a link to your own boot script which should create a
charlotte browser and a tab and load the home page.

    <script type="text/javascript" charset="utf-8" src="lib/cordova-1.5.0.js"></script>
    <script type="text/javascript" charset="utf-8" src="lib/underscore.js"></script>
    <script type="text/javascript" charset="utf-8" src="lib/async.js"></script>
    <script type="text/javascript" charset="utf-8" src="lib/zepto.js"></script>
    <script type="text/javascript" charset="utf-8" src="lib/charlotte/shared.js"></script>
    <script type="text/javascript" charset="utf-8" src="lib/charlotte/charlotte.js"></script>
    <script type="text/javascript" charset="utf-8" src="boot.js"></script>

(You'll need to have a process setup wherein these files are copied to your
xcode project's `www` directory when building. For instance, the [charlotte
demo][demo] project has a shell script called `copy_boot_scripts.sh` that is
called from a "Run Script" build stage in the xcode project.)

Create tab containers and tab content containers in the `index.html`:

    <body onload="onBodyLoad()">
      <div id="foo-tab" class="tab">
        <div id="content" class="content-container"></div>
      </div>
      <div id="bar-tab" class="tab">
        <div id="content" class="content-container"></div>
      </div>
    </body>


In your boot script, initialize the global charlotte object:

    charlotte.baseUrl = 'http://foo.com/';
    charlotte.rootUrl =  'http://local.host:3000/';
    charlotte.htmlBundleMode = true;

Then create a charlotte browser and some tabs:

    browser = charlotte.createBrowser();

    _.each(['foo', 'bar'], function(name) {
      browser.createTab({
        name: name, 
        container: '#' + name + '-tab'
      });
    });

And load the initial page into the initial tab:

    var fooTab = browser.switchTab('foo');
    fooTab.load({ url: '/' });

There are a number of possible options that you can and should specify when
you create a browser and when you load a page. Refer to the API documentation
below and check out the [charlotte demo][demo] app to learn more.

Optionally, may want to load newer versions of the core scripts required for
bootstrap from the server:

    charlotte.assets({ 
      javascripts: {
        urls: [
          "/lib/underscore", "/lib/async", "/lib/zepto", "/lib/jade",
          "/lib/charlotte/shared", "/lib/charlotte/charlotte"
        ]
      }
    }, next);

You'll want to do this before you create a browser. `charlotte.assets()` is
async so you should pass a callback method as the final argument which will be
invoked when all the assets have been loaded.

You may also may want to clean up the file cache on startup. This will clean
up all of the version caches except for the current version:

    charlotte.clearFileCache({
      versionExceptions: [localStorage.getItem("version")]
    }, next);

`charlotte.clearFileCache()` is also async and takes a callback as the final
argument.


# Template API

The template API provides a common set of variables and helper functions that
templates can use whether they are running on the server within node or on the
client.

## Asset Helpers

Asset helpers should *always* be used to include application assets. The
output shown below can be considered to be the *logical* output of these
helpers. When running in node on the server, the output is literally what is
shown and is rendered inline in the template output. When running in [*html
bundle*][html_bundles] mode on the client there's a bit more going on.

### javascripts

this:

    != javascripts('/js/underscore', '/js/async')
will output this:

    <script type="text/javascript" src="http://local.host:3000/versions/1.0/js/underscore.js"></script>
    <script type="text/javascript" src="http://local.host:3000/versions/1.0/js/async.js"></script>


### stylesheets
  
this:

    != stylesheets('/css/foo', '/foo/bar')
will output this:

    <link rel="stylesheet" type="text/css" href="http://local.host:3000/versions/1.0/css/foo.css"></link>
    <link rel="stylesheet" type="text/css" href="http://local.host:3000/versions/1.0/css/bar.css"></link>

### img

this:

    != img({src: '/img/foo.jpg'})
will output this:

    <img src="http://local.host:3000/versions/1.0/img/foo.jpg"></img>
    

Do not use the `img` helper to include non-application-asset images such as
user-generated content. Should only be used for images that are part of the
application itself, i.e. icons.

## Utility Helpers

* isBlank(varName) - returns `true` is the variable named `varName` in `this`
  scope is `undefined`, `null` or an empty string.

## Dynamic Helpers / Variables

* NODE_ENV - the value of the `NODE_ENV` environment variable (e.g.,
  development, production, etc.).

* rootUrl - the root url of the charlotte object, browser, or tab within which
  this template is rendered.
 
* assetRootUrl - the root url of the server for downloading application
  assets, i.e. javascripts, stylesheets, and image assets.

* version - the version of this request.

* requestId - the request id of this request (always `null` on the server).

* viewOnly - whether this is a view-only request.

* referer - the referer for this request -- use this instead of checking the
  `Referer` header.

* inNativeApp - this tells the template if it's running within a native app
  and device APIs are available.


# Client `window` API

The client side of the charlotte framework runs within the `window` of a web
browser or *web view* of a PhoneGap-based native app. The progressive
enhancement of your web app for a native environment happens within this
context.

## Callback Style

A side note here on callback style. Charlotte uses the standard node callback
style wherein an error is passed as the first argument to the callback; it
uses this style on the client as well as the server. This is true for
user-provided callbacks as well as the callbacks that Charlotte provides for
the user to call. So check the first argument for an error on any callbacks
that you pass to Charlotte. Send an `Error` object as the first argument when
invoking any Charlotte-provided callbacks to pass an error back to Charlotte.

Event handler callbacks, such as `ready` event handlers, are the exception to
this rule. By definition they are invoked to handle specific -- generally
non-error -- states and do not need an optional error argument.

## charlotte.ready(requestId, handler)

As with a typical web page, the action begins when the page is *ready*, and we
register a function to be invoked when it is.

Call the `charlotte.ready()` method to register functions to execute when the
page is ready:

    script(type="text/javascript")
      charlotte.ready('#{requestId}', function(callback) {
        $('#body-frame', this.container).height(window.innerHeight - 40);
        callback();
      });

`charlotte.ready()` takes 2 arguments:

* requestId - the id of the current request. you don't need to worry about
  what this is or how to get it -- charlotte provides it to you through the
  `requestId` helper in the template API. just interpolate the value into the
  template and pass it to the ready() method.
* your handler.  

Charlotte provides two things to your handler function. 

First it provides, as the only argument to the handler, a callback that must
be invoked when the handler is done doing what it has to do. This callback is
in the node style -- pass an error as the first argument to it if an error
occurs within your handler.

Ready event handlers are invoked in a chain, in order of their registration in
the flow of the HTML. The next handler is not invoked until the current one
has signaled completion by invoking its callback. Passing an error to the
callback halts the execution chain.

The second thing that charlotte provides to your handler is the value of
`this`. What is `this`, you ask? Read on to learn more ...

## Charlotte, Browsers, and Tabs

A page in a charlotte-based app can be executing in one of three possible
scopes or contexts, depending on how the page was loaded into the `window`.
The execution context defines the value of `this` in the page's `ready` event
handlers.

`this` is useful in a few of ways in your handler:

* you can access properties of the execution context, such as `container` and
  `rootUrl`.

* you can access asset loading methods of the execution context, such as
  `javascripts()` and `require()`, that are auto-versioned with the version of
  the current request.

* you can do some duck-typing on it to do different things depending on what
  the execution context is. for example, you will usually only want to
  override anchor tag click handlers when executing within a tab context.

### Global charlotte object

When not executing in [*html bundle*][html_bundles] mode, with templates being
rendered on the server in node, `this` in your ready handler is the global
`window.charlotte` object.

### Charlotte browser tab

Most pages in your app will be loaded into a charlotte browser tab. Tabs
maintain history as you load pages into them. You can go back and you can
reload. This is when you'll want to override anchor tag click handlers to load
linked pages into the current tab, or to go back in the history.

    function(callback) {
      var self = this,
          container = self.container;

      if (container) {

        $(self.contentContainer, container).on('click', '#nav-bar .button.left', function(e) {
          e.preventDefault();
          self.back();
        });
    
        $(self.contentContainer, container).on("click", 'a.post.show', function(e) {
          e.preventDefault();
          // this load is not very interesting without some load and back transitions
          // but i'm keeping this example short
          self.load({url: this.href});
        });
    
      }
      callback();
    }        

Only tabs have a `container` property so we use it above to determine if we're
in a tab execution context. It should also be used to scope any selector-based
operations. We use the tab `container` property above and it's
`contentContainer` property to select the root for event delegation.


### Charlotte browser

When you load a page into the DOM using the `request()` method on a charlotte
browser instance, `this` in your ready handler will be the browser object.
This will generally be the case when issuing AJAX-style requests to retrieve
page data or to update parts of a page outside of the normal tab history flow.

Typically, these types of requests occur to update part of a page within a
tab, so it is not necessary to add event event handlers so long as event
delegation was used properly when the tab was loaded. See the [charlotte
demo][demo] app for an example of this.

## DOM Event Handling

Because a charlotte-based application is underneath-the-hood still a
single-page application, and pages are removed from the DOM as they are popped
off the stack, it is important that [event
delegation](http://www.sitepoint.com/javascript-event-delegation-is-easier-than-you-think/)
be used properly. Use zepto's `on()` method to attach event handlers, not
`bind()`. In a tab execution context, use the supplied `container` and
`contentContainer` properties to select the root for event delegation:

    function(callback) {
      var self = this,
          container = self.container;

      if (container) {

        $(self.contentContainer, container).on('click', '#nav-bar .button.left', function(e) {
          e.preventDefault();
          self.back();
        });
    
      }
      callback();
    }

Charlotte will detach all event handlers from a page's content container when
`tab.back()` is called, to prevent any possible memory leaks. If you are
attaching event handlers to elements outside of the context of tabs in your
app then you are responsible for detaching those handlers when you remove the
elements from the DOM.

## Common properties

All of the execution contexts have these properties:

* **baseUrl** - this is the *logical* base url for the execution context. it
  is used in 2 ways:

  1. to resolve relative module names passed to the `require()` method. 

  2. whenever a module is encountered whose name is under `baseUrl` it will be
  retrieved using the `rootUrl`.
  
  only required if using AMD.

* **rootUrl** - the root url of the node server, used to resolve all relative
  paths (except for AMD module names). defaults to '/'; should be set to a
  full absolute URL in a native app execution environment. will typically be
  equal to the `baseUrl` only in production.

* **assetRootUrl** - the root url of the static asset server, used to resolve
  all relative asset paths. if no `assetRootUrl` is provided, the `rootUrl`
  will be used.

Generally, it is only necessary to set these properties on the global
`charlotte` object, as browsers created by it will inherit these values, and
tabs will inherit these values from browsers.

It is theoretically possible, however, to have multiple browsers in an app
with different bases/roots, or tabs within a browser that have different
bases/roots.

## Common methods

### Asset methods

All of the execution contexts have methods to dynamically load application assets: 

* `stylesheets(options, callback)` - load CSS stylesheets.

* `javascripts(options, callback)` - load JavaScript files.

The options for each of these methods are: 

* **urls** - an array of resource paths minus the filename extensions (i.e.
  "/foo/bar", instead of "/foo/bar.js")

* **version** - version of assets to load. relative resource paths will be
  versioned using this value (e.g. "/foo/bar" -> "/versions/1.0/foo/bar")

* **rootUrl** - url of node server; this server will be used to retrieve the
  current version if none is provided

* **assetRootUrl** - static asset server that assets will be downloaded from; the
  `rootUrl` will be used if no assetUrl is provided here or on the object
  itself.

If the `version`, `rootUrl`, and `assetRootUrl` options are not provided, the
properties of the execution context will be used.

There's also a wrapper around these methods that can be used to load both
stylesheets and JavaScripts at once:

* `assets(options, callback)` 

The two possible options are:

* **javascripts** - options for the JavaScripts load

* **stylesheets** - options for the stylesheets load

### AMD

In addition to the asset methods described above, Charlotte provides an AMD
module loading mechanism. Each of the execution contexts has a `require()`
method.

* require(options, callback)

The options are the same as the options to the other asset loader methods
plus:

* **dependencies** - array of module names.

* **baseUrl** - used to resolve relative module names in the dependencies list

Modules are defined using the `charlotte.define()` method.

#### Ready event handler modules

In many cases, all you want to do in your `ready` event handlers is require a
module and invoke it in this manner:

    charlotte.ready('#{requestId}', function(callback) {
      this.require(
        {
          dependencies: ['foo/bar']
        }, 
        function(err, foobar) {
          if (err) return callback(err);
          foobar.call(this, callback);
        });
    });

Modules names can be specified as `ready` event handlers. When this is done
Charlotte will automatically require the module and call it using the
execution context as `this`, and pass the `ready` handler callback as the only
argument. The code below is equivalent to the above:

    charlotte.ready('#{requestId}', 'foo/bar');
  
# charlotte

In addition to the common ones, the charlotte object has these properties and
methods:

* **htmlBundleMode** - flag indicating whether charlotte is in [*html
  bundle*][html_bundles] mode.

* **cacheSeedLocation** - url of cache seed. should be relative to the app
  location and will be resolved relative to the `www` directory in the native
  app. defaults to `'./cache_seed'`.

* **readyRegistryTimeToLive** - how long ready event handlers should live
  before being purged, in milliseconds.  defaults to 15000.

* **tempCacheSize** - the size, in characters, of the in-memory temp cache.
  older entries in the cache will be purged when this size is exceeded to make
  room for newer ones.

* `define(name, [dependencies,] callback)`

  * **name** - the name is required and should be a **fully-qualified** absolute url.

  * **dependencies** - array of module names. relative names will be resolved
    using the fully-qualified name of the module itself, and interpreted as
    root-relative to that name. e.g. if the name of the module is
    "http://foo.bar/foo", then a dependency with the name "/bar" will be
    resolved as "http://foo.bar/bar".

* `createBrowser(options)` - options to this method are discussed in detail in
  the browser API section.

* `clearFileCache(options, callback)` - clears the filesystem cache for a particular
  `rootUrl`. options are:

  * **rootUrl** - the root url of the cache to clear; if not provided the
    rootUrl of charlotte object will be used.

  * **versionExceptions** - an array of version strings that should be
    *not* be cleared.

* `clearRamCache(options)` - clears the RAM cache for a particular `rootUrl`
  (including the temp cache). options are the same as those for
  `clearFileCache()`. this method is mainly used internally to clear the RAM
  cache when a version change is detected.


# browser

In addition to the common ones, a charlotte browser has the following methods.

## createBrowser(options)

The `createBrowser()` method is actually on the `charlotte` object, but it
plays the role of constructor for a browser instance so we discuss its details
here.

The `baseUrl`, `rootUrl`, and `assetUrl` can be provided as options. If not
provided, the browser instance will inherit those of the `charlotte` object
that created it. Other options are described below.

### followRedirects

Whether redirects on a `request()` should be followed. If `false`, a
`charlotte.RedirectError` will be generated. Default is `true`.

### layoutBody

The default layout body template.  Default is `'layout_body'`.

### templateCompilers

A hash of compilers for different template types.  Default is:

    {
      '.jade': function(text) {
        return jade.compile(text);
      }
    }

### defaultTemplateExtname

Template extension to use for template paths that omit the filename extension.
Default is ".jade".

### helpers

Static helpers that will be available to templates. You'll want to use the
same ones here that you use on the server.

### dynamicHelpers

Dynamic helpers that will be available to templates. You'll want to use the
same ones here that you use on the server.

Dynamic helpers that depend on the `res` argument are not supported. There is
limited support for dependence on the `req` argument -- basically just the
`referer` and `viewOnly` properties and the `flash()` method, currently.

### timeout

Timeout value for any network operations. `charlotte.ServerUnavailableError`'s
will be generated when requests take longer than the timeout.

### cachedBundles

Used to configure what [html bundle][html_bundles] resources (pages,
essentially) will be cached and in what manner. Each of these options takes a
set of matchers against which the url for a resource will be tested. A matcher
can be a regular expression or a function that returns a boolean. A matcher
function takes two arguments:

`function(url, parsedUrl)`:

* **url** - the url as a string

* **parsedUrl** - the url as a parsed object with
  [attributes](http://dev.w3.org/html5/spec/urls.html#url-decomposition-idl-attributes).

The different cachedBundles options are:

* **urlMatchers** - any array of matchers for resources to be cached
  permanently.

* **tempUrlMatchers** - any array matchers for resources to be cached in the
  in-memory temp cache.

* **viewOnlyUrlMatchers** - a hash of named matchers for view-only resources.
  since many resources can share the same view-only representation we give
  that representation its own name and store it under that name rather than
  name of the resource itself, to avoid duplication. see the [charlotte
  demo][demo] for examples.

### errorHandlers

Error handler callbacks to be invoked when an error occurs while processing a
`request()` or `tab.load()`.

`global: function(err, tab)`

The global error handler *always* gets invoked for every error. Logging the
error somewhere is something you may want to do in a global error handler.

`default: function(err, tab, next)`

This is the default error handler for any `request()` calls or `tab.load()`
calls that do not specify an `onError` option. The `next` argument is a
callback that you should invoke if you'd like to continue processing and for
the error to be passed on to the request/load callback.

### onCacheMiss(url, tab, afterViewLoad)

Callback that is invoked if the network is accessed at any point while
processing a `request()` or `tab.load()` call. Only invoked once per
request/load even if multiple network accesses occur.

The `url` argument is of the *actual* resource on which the first cache miss
occurred while processing the request, i.e. potentially a JavaScript file that
has to be downloaded if the html bundle was retrieved from the cache. Thus,
the url may not be the same as the url of the page that was being loaded.

The `afterViewLoad` argument indicates whether this cache miss occurred on a
view-only load after the view has been completely loaded.

This callback will *not* be invoked if overridden at the request/load level.

### onRequestEnd(settings, tab)

Callback that is invoked when any `request()` (which is also used internally
by `tab.load()`) is fully processed. One use case for this is to hide a
"loading" status message that you displayed on cache miss.

This callback will *not* be invoked if overridden at the request/load level.

### onVersionChange(localVersion, remoteVersion, callback)

Callback that is invoked whenever a version change is detected while
processing an html bundle request. `localVersion` is the current local version
and `remoteVersion` is the new remote version returned from the server. Invoke
`callback` if you'd like the processing of the request to continue, otherwise
don't.

## createTab(options)

The options to this method are discussed in detail in the tab API section.

## currentTab()

Returns the currently selected tab.

## switchTab(name)

Switches to the tab with the give `name`.

## request(settings, callback[, renderWait])

Issues an [html bundle][html_bundles] request.

The `settings` are the same settings accepted by a zepto `ajax()` request,
plus:

* **viewOnly** - whether this is a view-only request

* **container** - the DOM container into which the page should be loaded.

* **followRedirects** - override of the browser option with the same name.

* **layoutBody** - ""

* **onCacheMiss** - ""

* **uploadOptions** - a PhoneGap
  [FileUploadOptions](http://docs.phonegap.com/en/1.5.0/phonegap_file_file.md.html#FileUploadOptions)
  object. should have a `fileUri` attribute in addition to the standard
  PhoneGap attributes. when this is option is passed, an upload using the
  PhoneGap
  [FileTransfer](http://docs.phonegap.com/en/1.0.0/phonegap_file_file.md.html#FileTransfer)
  object is done.

The `callback` is invoked when the request is complete and has this signature:

`function(err, bundle, html, triggerReady)`

* **bundle** - the [html bundle][html_bundles] object. 

* **html** - the html content that was loaded into the specified container.

* **triggerReady** - a function to call to trigger the `ready` event on the
  page. ready event handlers will not be executed until this function is
  called. you can also pass a callback to this function to be invoked after
  the execution of the ready event handler chain is complete, though you will
  rarely need to do this.

The optional `renderWait` argument is a callback that can be used to delay the
rendering of the bundle into HTML until some condition is met. If provided, it
is given a callback to invoke when you're ready to render. (`tab.load()` uses
this internally to delay the rendering of the full page on view-only-first
loads until the view-only load, including transition and ready event handlers,
has completed processing.)

# tab

In addition to the common ones, a charlotte tab has the following  methods.

## createTab(options)

The `createTab()` method is actually on a browser object, but it plays the
role of constructor for a tab instance so we discuss its details here.

The `baseUrl`, `rootUrl`, and `assetUrl` can be provided as options. If not
provided, the tab instance will inherit those of the browser object that
created it.

Other options are:

* **name** - a unique name for the tab.

* **container** - CSS selector identifying the container element for the tab.

* **contentContainer** - CSS selector identifying the container element for the
  content within the tab. Scoped to the tab container. Defaults to
  '#content'.

* **createContentContainer** - an optional callback that should be invoked when
  creating a new content container to load a new page into.

The default createContentContainer function is:

    function defaultCreateContentContainer() {
      var container = document.createElement('div');
      container.className = 'content-container';
      container.style.display = 'none';
      return container;
    }

## load(settings)

Loads a new page into the tab. Accepts all the of the settings that zepto's
`ajax()` method takes plus:

* **followRedirects** - override of the browser option with the same name.

* **onCacheMiss** - ""

* **onViewLoad** - options for the view-only load event.

* **onLoad** - options for the load event.

* **onBack** - options for the back event (loaded page is popped off the
  stack).

* **onError** - override of the `errorHandler.default` browser option. 

`onViewLoad`, `onLoad`, and `onBack` all take the same options, both of
which are optional.

* **transition** - callback to handle the transition of the loaded content
  from staging container to current content container.

* **callback** - callback to be invoked when the processing of the load,
  including optional transition, is complete.

The signature for the `onViewLoad` and `onLoad` callbacks looks like:

`function(err, bundle, triggerReady)`

* **err** - an error object if an error occurred while processing the load.
  any errors passed to ready event handler callbacks will end up here, too.

* **bundle** - html bundle response.

* **triggerReady** - a function to call to trigger the `ready` event on the
  page. ready event handlers will not be executed until this function is
  called. you can also pass a callback to this function to be invoked after
  the execution of the ready event handler chain is complete, though you will
  rarely need to do this.

If the `callback` option is not provided for these events, `triggerReady()`
will be automatically executed.

The `onBack` callback looks like:

`function(options)`

The `options` are user-defined, and are whatever was passed in the
`tab.back()` call.

### Transitions

The transition option is a function that takes a content container, a content
stage container, and callback:

`transition: function(contentCtr, contentStageCtr, callback)`

It causes the `contentStageCtr` to take over the viewing area currently
occupied by the `contentCtr`, as well as *assume its identity*. It invokes the
`callback` argument when the transition is complete. 

The transition could involve moving the `contentCtr` out of the way, covering
it, etc. It will be removed from the DOM when the callback is
called.

For `on[View]Load` events, the `contentStageCtr` contains the newly loaded
page content. For the `onBack` event, the `contentStageCtr` contains the
previous page in the tab history.

### View-only first loads

Responsive user interfaces require that some sort of view be displayed to the
user upon the touch of a button, even if some latency is involved in rendering
the full content of a page. The view-only-first mechanism helps to address
that need.

When an `onViewLoad` setting is specified in a `load()` call, charlotte will
actually coordinate the handling of 2 distinct html bundle requests: 

* one request with a `viewOnly=true` query string param appended to the url
* one request with the provided url

The Express route for the url can detect this parameter with the
charlotte-provided `req.viewOnly` property and should render a response that
does not block on any external IO and returns a response immediately:

    app.get('/posts', function(req, res) {

      if (req.viewOnly) {
        res.render('posts/index', {
          title: "Post list",
          posts: [] 
        });
      } else {
        Posts.all(function(posts) {
          res.render('posts/index', {
            title: "Post list",
            posts: posts
          });      
        });
      }
  
    });

Charlotte will fire off the two requests in parallel but it will always invoke
the `onViewLoad` callbacks first, even if for some reason the regular load
returns a response first. Also, it will not invoke the `onLoad` callback until
the `triggerReady` for `onViewLoad` is called, even if the regular load
returns while the `onViewLoad` callback is being executed.

Caching of view-only responses, which is discussed in the **Caching and
Versioning** section, will avoid network roundtrips and allow for minimal
latency between the touch of a button and the display of the view, and we can
typically cache them forever as they will generally be essentially static and
have no dynamic components.

### Redirects

The `tab.load()` method has some special handling for redirects when the
`followRedirects` option is `true` (the default). If the location being
redirected to is equal to the current page (not including search component of
the urls), the tab will automatically `reload()` the current page (with the
new location, including new search component if it exists). If it's equal to
the previous page, the tab will automatically call `back()` on itself and then
`reload()` that previous page. This is useful, for instance, in a modal form
when you want the tab to automatically go back to the previous page after
posting the form and to refresh that page's contents.

There is some magic going on to make this happen as true redirects are
transparent to XHR clients. Charlotte monkeypatches the Express
`res.redirect()` method to make these pseudo-redirects visible to the
charlotte client runtime. As long as `res.render()` is used to do redirects,
this behavior will be observed. Issuing a true redirect by setting a `302`
status and setting a `Location` header will bypass this magic. (Note: for
non-html-bundle requests `res.redirect()` will continue to do the normal thing
and send a `302` with a `Location` header)

Currently this is only enabled for posts. I don't remember why. If
I come across a good reason to enable it for gets I will.

### Posts

The `tab.load()` method also has some special handling for posts.

One kind of special handling is for posts that redirect back to the page that
the post was submitted from, or to the previous page. As mentioned above, the
tab will automatically `reload()` those pages in such cases. When such loads
that are the result of redirects from posts occur, Charlotte will ignore the
cache and always go to the server for the page (specifically, for the html
bundle -- the cache will still be consulted for assets). It will also not
cache the response. This allows any errors sent by the `req.flash()` method to
be displayed, and not cached. The cached page will still be used for initial
get loads of the page with the form.

Also, posts that return a normal non-redirect response do not affect tab
history. This fits the use case of a form that repeatedly returns errors to
the client until valid data is submitted. Going back in the tab history from
the point when a successful submit eventually occurs should not have to go
through a series of error response pages. See the [charlotte demo][demo] for
an example of this and it should be more clear why this special handling is a
good thing for native apps.

## reload(callback)

Reloads the current page in the tab.

## back(options)

Goes back in the tab history, causing the previous page in the tab history to
be displayed. The `onBack` options -- `transition` and `callback` -- specified
when the page was loaded will be invoked. The current page will be popped from
the stack and permanently removed from the DOM.

## length()

Returns the length of this tab's history.

## first()

Returns the `settings` for the first page loaded into this tab. 

## current()

Returns the `settings` for the current page in this tab.

## previous()

Returns the `settings` for the previous page in this tab.

## Error Handling

As mentioned in the discussion on callback style, errors are generally passed
to callback functions in the style of node, as the first argument. Charlotte
also allows error handlers to be registered on a browser instance for errors
that occur when attempting to load a page, either through the
`browser.request()` method or the `tab.load()` method.

## The Error Handler Chain

When an error occurs during a page load, the error is passed along a chain.
For a `browser.request()` call the chain looks like this:

    global -> default [-> callback]

The chain for a `tab.load()` call is slightly different and looks like this:

    global -> settings.onError || default [-> callback]

Both start with the `global` handler specified in the `createBrowser()` options:

`function(err, tab)`

* **err** - the error.

* **tab** - the tab the error occurred in if it occurred on a tab load.

The global handler is always invoked for every error that occurs on a browser
request or tab load, and is the first to be invoked. The next error handler in
the chain will always be called immediately after the global is invoked, so no
callback is passed to it.

Next in line is the default error handler:

`function(err, tab, next)`

It takes the same arguments as global handler plus a callback that can be
optionally invoked to pass the error down to the next handler in the chain.
The default error handler can be overridden on a tab load by specifying an
**onError** setting.

Finally, if the `next` callback is invoked in the default or settings.onError
handler, the error will be passed to the request-level callback will be
invoked and passed the error as the first argument.

## Error Types

Charlotte will generate the error types below to handle internal exceptions
encountered while processing a request. You can check for these in your
error handlers to handle specific error conditions.

    if (err instanceof charlotte.ServerUnavailableError) {
      alert("Server is unavailable");
    } else if (err instanceof charlotte.ResourceNotFoundError) {
      alert("Couldn't find that. Maybe it got deleted?");
    ...

### charlotte.ServerUnavailableError

### charlotte.ResourceNotFoundError

### charlotte.RedirectError

### charlotte.AssetLoadError

### charlotte.util.VersionMismatchError

## `completeBundleProcess`
 
## charlotte.util

* `propertyHelper()` this method can be used to create request scope
  properties that can be set and accessed from templates. this allows a
  template used to render the body of a response to set a property used by the
  layout body that includes it, i.e. where the cancel link should point to in
  the modal form layout body.

* `semanticVersion()`

* `VersionMismatchError`

* `isBlank(varName)`

* `parseUrl(url)`

## charlotte.pagetransitions

# Caching and Versioning

## Versioning

Charlotte is very aggressive in its caching. It caches resources in the local
filesystem and in memory and will always consult caches before reaching across
the network for them. It only hits the network when it has to, and an
app-level version change (more precisely, a `rootUrl`-level version change) is
the signal that tells it to do so. The assumption of this signal is also what
allows it to avoid any network costs (i.e. even the relatively small cost of a
conditional GET to check if a particular resource has changed) most of the time
for cached data. It also allows for partial functionality in offline
conditions.

### onVersionChange

## Filesystem Cache

Charlotte uses the [PhoneGap File
API](http://docs.phonegap.com/en/1.5.0/phonegap_file_file.md.html) to cache
resources locally. The cache is organized by root url/version/resource host.

Here's what the [charlotte demo][demo] cache directory tree looks like:

    |-local.charlottedemo.com_3000_
     |---1.0
     |-----local-assets.charlottedemo.com_3000
     |-------versions
     |---------1.0
     |-----------lib
     |-------------charlotte
     |-------------common
     |-----------messages
     |-----------posts
     |-----------tab_menu
     |-----------users
     |-----local.charlottedemo.com_3000
     |-------posts
     |---------new
     |-------tab_menu
     |-------view_only_bundles


## RAM Cache

## Resource types

### Templates

### JavaScripts

### Stylesheets

### Images

## Html Bundles

## Disabling Caching for Development

## Versioned Asset Deployment

## Cache Seed

# Some general guidelines

* use the charlotte asset helper methods to output script tags, link tags, and
  image application assets.

* view templates should be specified with full root-relative paths in
  `res.render()` calls. charlotte will not apply the view lookup logic that
  Express does.

* view templates should only access locals, not session or global state.

* locals should only be accessed in templates as pure data, no method calls.

* be careful not to include any sensitive information in your template source
  code as the source files will eventually be served statically, with no
  authentication, for distribution to native apps.

* `undefined` values do not get serialized in JSON. attributes with a value of
  `undefined` are simply excluded. when rendering client-side in a native app,
  attempts to access absent locals in your templates will result in reference
  errors. make sure all locals are defined, setting them to an appropriate
  default if necessary, before calling `res.render`. or, alternatively, make
  sure your template accounts for such potentially undefined values my testing
  if `'undefined' === typeof myVar` before attempting to access them.
  charlotte provides a helper method `isBlank(myVarName)` that will safely
  check if the variable named myVarName is undefined, `null`, or an empty
  string.

* dynamic helpers that depend on the `res` argument are not supported. there
  is limited support for dependence on the `req` argument -- basically just
  the `referer` and `viewOnly` properties and the `flash()` method, currently.

* the `flash()` method will work slightly differently when running in html
  bundle mode app than it does when running in node. flash messages will only
  be accessible in a native app on the immediately subsequent request, after
  which they will be cleared even if not accessed during that request. that
  also means they will not be accessible on the same request that they are
  created. this fits with the general use case for the `flash()` method; your
  app should not depend on support for other use cases.



[demo]: https://github.com/danieldkim/charlotte_demo  "Charlotte demo"

[html_bundles]: https://github.com/danieldkim/charlotte/wiki/Html-Bundles "HTML Bundles"
