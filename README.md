[![Build Status](https://secure.travis-ci.org/danieldkim/charlotte.png?branch=master)](http://travis-ci.org/danieldkim/charlotte)

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

* PhoneGap >=1.6.1

* jade (optional)

# Express Setup

Install charlotte:

    npm install charlotte
    
Require charlotte:

    var charlotte = require('charlotte');
    
Set a version:

    charlotte.version = "1.0";

Support express (do this just before you use the router middleware):

    charlotte.supportExpress(app, { 
      assetRootUrl: 'http://assets.local.host:3000/',
      viewExtensions: 'default' 
    });
    app.use(app.router);    

The `assetRootUrl` option will be used by the [asset helpers](#asset-helpers)
when outputting urls for asset tags. This can be omitted if not using a
separate asset server. 

The `viewExtensions` option specifies the extensions of view resources that
should be served statically. This is useful if you have static file paths that
match/conflict with any of your Express routes, and can be omitted if you
don't. Should also be omitted in environments where static asset requests are
served by a separate server and never enter node. If 'default' is specified
these are the extensions that will be served statically:

    ['jade', 'css', 'js', 'jpg', 'gif', 'png']

There is also a `templateExtensions` option that will simply add the specified
template extensions to the default view extensions.

Serve up all views statically:

    app.use(express.static(__dirname + '/views'));

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
the `baseUrl`, `assetRootUrl`, and `version` attributes on the global
charlotte object. When running in [*html bundle*][html_bundles] mode and
rendering templates on the client, the `baseUrl` and `assetRootUrl` attributes
will be set by the bootstrap process , which you can see in the **Client
`window` setup** section of this document, and the version will be handled in
a different manner.

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

## <a id="asset-helpers"></a>Asset Helpers

Asset helpers should *always* be used to include application assets. The
output shown below can be considered to be the *logical* output of these
helpers. When running in node on the server, the output is literally what is
shown and is rendered inline in the template output. When running in [*html
bundle*][html_bundles] mode on the client there's a bit more going on.

### javascripts

this:

    != javascripts('/js/underscore', '/js/async')

or this:

    != javascripts(['/js/underscore', '/js/async'])

will output this:

    <script type="text/javascript" src="http://assets.local.host:3000/versions/1.0/js/underscore.js"></script>
    <script type="text/javascript" src="http://assets.local.host:3000/versions/1.0/js/async.js"></script>


### stylesheets
  
this:

    != stylesheets('/css/foo', '/foo/bar')

or this:

    != stylesheets(['/css/foo', '/foo/bar'])

will output this:

    <link rel="stylesheet" type="text/css" href="http://assets.local.host:3000/versions/1.0/css/foo.css"></link>
    <link rel="stylesheet" type="text/css" href="http://assets.local.host:3000/versions/1.0/css/bar.css"></link>

### img

this:

    != img({src: '/img/foo.jpg'})
will output this:

    <img src="http://assets.local.host:3000/versions/1.0/img/foo.jpg"></img>
    

Do not use the `img` helper to include non-application-asset images such as
user-generated content. Should only be used for images that are part of the
application itself, i.e. icons.

### assetUrl(url)

Sometimes you want to output an asset url in your markup outside of a script,
link, or img tag (e.g. as a `background-image` property in an inline style).

this (jade):
  
    div(style="background-image: url('#{assetUrl("/img/foo.jpg")}')")
  
will output this:

    <div style="background-image: url('http://assets.local.host:3000/versions/1.0/img/foo.jpg')"></div>


## Utility Helpers

* isBlank(varName) - returns `true` is the variable named `varName` in `this`
  scope is `undefined`, `null` or an empty string.

## Dynamic Helpers / Variables

* NODE_ENV - the value of the `NODE_ENV` environment variable (e.g.,
  development, production, etc.).

* context - the context within which this template is executing. will be the
  Express `app` object when rendered server-side; can be either a *browser* or
  a *page* when executing client-side (see discussion of **[Charlotte,
  Browsers, Tabs, and Pages](#charlotte-browsers-tabs-and-pages)** below).

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

* requestIsSecure - whether the current request is an https request.

# Express Request Helpers

* acceptsHtmlBundle - whether the request is an [html bundle][html_bundles]
  request.
  
* referer - a property that returns what the name implies.  works in [html
  bundle][html_bundles] mode and normal request mode.

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
      charlotte.ready('!{requestId}', function(callback) {
        $('#body-frame', this.container).height(window.innerHeight - 40);
        callback();
      });

`charlotte.ready()` takes 2 arguments:

* requestId - the id of the current request. you don't need to worry about
  what this is or how to get it -- charlotte provides it to you through the
  `requestId` helper in the template API. just interpolate the value into the
  template and pass it to the ready() method (be sure to use the unescaped
  form of interpolation).

* your handler.  

Charlotte provides two things to your handler function. 

First it provides, as the only argument to the handler, a callback that must
be invoked when the handler is done doing what it has to do. This callback is
in the node style -- pass an error as the first argument to it if an error
occurs within your handler.

Ready event handlers are invoked in a chain, in order of their registration in
the flow of the HTML. The next handler is not invoked until the current one
has signaled completion by invoking its callback. Passing an error to the
callback halts the execution chain. You could implement a global ready event
handler that always gets invoked first on every page by including it in a
partial at the beginning of every page.

The second thing that charlotte provides to your handler is the value of
`this`. What is `this`, you ask? Read on to learn more ...

## <a id="charlotte-browsers-tabs-and-pages"></a>Charlotte, Browsers, Tabs, and Pages

The JavaScript executing in a rendered page in the client environment (i.e.,
after the template has been executed and the html generated) in a
charlotte-based app can be executing in one of three possible scopes or
contexts, depending on how the page was loaded into the `window`. The
execution context defines the value of `this` in the page's `ready` event
handlers.

`this` is useful in a few of ways in your handler:

* you can access properties of the execution context, such as `container` and
  `rootUrl`.

* you can access asset loading methods of the execution context, such as
  `javascripts()` and `require()`, that are auto-versioned with the version of
  the current request.

* you can do some duck-typing on it to do different things depending on what
  the execution context is. for example, you will usually only want to
  override anchor tag click handlers when executing within a page context.

### Global charlotte object

When not executing in [*html bundle*][html_bundles] mode, with templates being
rendered on the server in node, `this` in your ready handler is the global
`window.charlotte` object.

### Charlotte browser tab page

Most pages in your app will be loaded into a page of a tab in a charlotte
browser. Tabs maintain history as you load pages into them. You can go back
and you can reload. This is when you'll want to override anchor tag click
handlers to load linked pages into the current tab, or to go back in the
history.

    function(callback) {
      var self = this,
          container = self.container;

      if (container) {

        $(container).on('click', '#nav-bar .button.left', function(e) {
          e.preventDefault();
          self.back();
        });
    
        $(container).on("click", 'a.post.show', function(e) {
          e.preventDefault();
          // this load is not very interesting without some load and back transitions
          // but i'm keeping this example short
          self.load({url: this.href});
        });
    
      }
      callback();
    }        

Only pages have a `container` property so we use it above to determine if
we're in a page execution context. It should also be used to scope any
selector-based operations. We use the page `container` property to select the
root for event delegation.

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
`bind()`. In a page execution context, use the supplied `container` property
to select the root for event delegation:

    function(callback) {
      var self = this,
          container = self.container;

      if (container) {

        $(container).on('click', '#nav-bar .button.left', function(e) {
          e.preventDefault();
          self.back();
        });
    
      }
      callback();
    }

Charlotte provides a couple of convenience methods on the execution context --
`on()` and `find()` -- that are automatically scoped to the context's
container. Using `on()`, the above can be written like so:

    function(callback) {
      var self = this;

      this.on('click', '#nav-bar .button.left', function(e) {
        e.preventDefault();
        self.back();
      });

      callback();
    }

Charlotte will detach all event handlers from a page's container when `back()`
is called, to prevent any possible memory leaks.

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

* **contentContainer** - CSS selector identifying the container element for
  the content within this context (implicitly scoped to this context).
  defaults to '#content'.

Generally, it is only necessary to set these properties on the global
`charlotte` object, as browsers created by it will inherit these values, and
tabs will inherit these values from browsers.

It is theoretically possible, however, to have multiple browsers in an app
with different bases/roots, or tabs within a browser that have different
bases/roots.

### <a id="before-ajax"></a>beforeAjax(url, settings, callback)

Charlotte provides a way for you to intercept calls to its low-level internal
AJAX API and modify the arguments passed to if desired.  This can be done at the
charlotte, browser, and tab levels by setting the `beforeAjax`callback at that
level.  If set at multiple levels their invocations will be chained starting at
the most specific level, the result of the previous level being passed up the
chain.  These callbacks will be executed whenever Charlotte makes an AJAX
request internally to do its work (including when downloading templates and when
loading assets from the [cache seed](#cache-seed)).

The arguments to `beforeAjax` are

* **url** - the url of the request

* **settings** - the settings object that will be passed to zepto

* **callback(err[, url[, settings]])** - a callback to invoke when you're done
  to invoke the next function in the chain.  if `url` and/or `settings`
  arguments are passed they will passed to the next function instead of the
  arguments received by this function.

An example is illustrative.  Below is a simplified version of a `beforeAjax`
callback that I use in an app to send an `X-next-version` header so that it can
be used by proxy servers to route the request to node processes running the next
version of the code while the app is in review:

    charlotte.beforeAjax = function(url, settings, callback) {
      var version,
        _this = this;
      function addHeader() {
        settings.headers = settings.headers || {}
        settings.headers['X-next-version'] = 'yes';
      }
      if ((settings && settings.bypassInReviewCheck) || !url.match(/^http/)) {
        callback();
      } else if (this.inReview) {
        addHeader();
        callback(null, url, settings);
      } else {
        this.ajax({
          url: this.rootUrl  + "version",
          bypassInReviewCheck: true
        }, function(err, data) {
          if (err) {
            callback(err);
          } else if (data == window.bootConfigVersion) {
            delete _this.beforeAjax;
            callback();
          } else {
            _this.inReview = true;
            addHeader();
            callback(null, url, settings);
          }
        });
      }
    };

The method above checks to see if the version the app is built as is equal to
the currently deployed server version.  If so, it deletes itself.  Otherwise, it
sets an `inReview` flag to `true` and adds the `X-next-version` header to the
current and subsequent requests.

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

* **assetRootUrl** - static asset server that assets will be downloaded from;
  the `rootUrl` will be used if no assetRootUrl is provided here or on the
  object itself.

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

    charlotte.ready('!{requestId}', function(callback) {
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

    charlotte.ready('!{requestId}', 'foo/bar');
    
### DOM methods 

* `find(selector)` - executes a Zepto `find()` within the content container for
  this context.

* `on(type, [selector], handler)` - executes a Zepto `on()` on the content
  container for this context .

### ajax(settings, callback)

The charlotte and browser objects have an `ajax` method that you can use which
is a thin wrapper around zepto's ajax method, with a node-style callback
interface, relative url resolution, generation of charlotte 
[error types](#error-types), and execution of [beforeAjax](#before-ajax)
callbacks.

It's generally recommended that you use this method if you need to issue manual
AJAX requests.

# charlotte

In addition to the common ones, the charlotte object has these properties and
methods:

* **htmlBundleMode** - flag indicating whether charlotte is in [*html
  bundle*][html_bundles] mode.

* **cacheSeedLocation** - url of cache seed. should be relative to the app
  location and will be resolved relative to the `www` directory in the native
  app. defaults to `'./cache_seed'`.

* **cacheSeedBinaryFiles** - a list of paths of all the binary files in the
  cache seed, root-relative to the `cacheSeedLocation`.

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

* `removeFromFileCache(paths, callback)` - removes only certain files from the
  file cache.  pass an array of file paths in the `paths` argument.  use the
  path that is logged to the console when a file is downloaded (look for log
  lines that say "Downloaded file: /path/to/myfile.js").  you can also see the
  full path to a file through different simulator/device-specific means.  for
  instance you can use the XCode Organizer to browse the filesystem for an app
  installed on an iphone (the full path to the file would include every
  component of the path under the Documents directory).  this function is useful
  when debugging on a device and versioning is on.  you can make changes to just
  a few files on the server, delete them from the file cache, restart your app, 
  and charlotte will download the missing files (for changes that are confined 
  to templates and for purely additive css changes it should be sufficient to
  clear the RAM cache and reload the page vs. restarting the app entirely).

* `addCompiledTemplates(version, templates)` - adds precompiled templates to
  the resource cache.  `templates` is a hash of template functions keyed by
  their full absolute url.  the functions can be in function or string form.

* `setTemplatesJs(version, url, callback)` - uses the specified templates file
  as input to the `addCompiledTemplates()` method.  `url` is a relative url that
  will be auto-versioned; this method will look in the local asset cache and
  cache seed before requesting it from the server.

* `clearRamCache(options)` - clears the RAM cache for a particular `rootUrl`
  (including the temp cache). options are the same as those for
  `clearFileCache()`. this method is mainly used internally to clear the RAM
  cache when a version change is detected.

* `getVersionKey()` - returns the key used to access/store the current version
  in `localStorage`.  is based on the `rootUrl`.


# browser

In addition to the common ones, a charlotte browser has the following properties.

## createBrowser(options)

The `createBrowser()` method is actually on the `charlotte` object, but it
plays the role of constructor for a browser instance so we discuss its details
here.

The `baseUrl`, `rootUrl`, and `assetRootUrl` can be provided as options. If
not provided, the browser instance will inherit those of the `charlotte`
object that created it. Other options are described below.

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

`global: function(err, page)`

The global error handler *always* gets invoked for every error. The `page`
argument is the page that the error occurred on if it was a `tab.load()` call.
Logging the error somewhere is something you may want to do in a global error
handler.

`default: function(err, page, next)`

This is the default error handler for any `request()` calls or `tab.load()`
calls that do not specify an `onError` option. The `next` argument is a
callback that you should invoke if you'd like to continue processing and for
the error to be passed on to the request/load callback.

### onCacheMiss(url, page, afterViewLoad)

Callback that is invoked if the network is accessed at any point while
processing a `request()` or `tab.load()` call. Only invoked once per
request/load even if multiple network accesses occur.

The `url` argument is of the *actual* resource on which the first cache miss
occurred while processing the request, i.e. potentially a JavaScript file that
has to be downloaded if the html bundle was retrieved from the cache. Thus,
the url may not be the same as the url of the `page` that was being loaded if
the cache miss occurred during a `tab.load()` call.

The `afterViewLoad` argument indicates whether this cache miss occurred on a
view-only load after the view has been completely loaded.

This callback will *not* be invoked if overridden at the request/load level.

### onRequestEnd(err, settings, page, bundle)

Callback that is invoked when any `request()` (which is also used internally
by `tab.load()`) is fully processed. One use case for this is to hide a
"loading" status message that you displayed on cache miss.

    onRequestEnd: function(err, settings, page, bundle) {
      if (!(err instanceof charlotte.RedirectError)) {
        hideLoadingMessage(page);
      }
    }

This callback will *not* be invoked if overridden at the request/load level.

### onVersionChange(localVersion, remoteVersion, callback)

Callback that is invoked whenever a version change is detected while
processing an html bundle request. `localVersion` is the current local version
and `remoteVersion` is the new remote version returned from the server. Invoke
`callback` if you'd like the processing of the request to continue, otherwise
don't.

### onDestroy(contentCtr)

A function that takes a content container that is being removed from the DOM
and does any necessary clean up, such as [cleaning up
images](http://www.fngtps.com/2010/mobile-safari-image-resource-limit-workaround/)
(cleanup of event handlers added to the `contentCtr` through Zepto's `on()`
method is already taken care of by Charlotte). It will be called be called on
the specified container of any [`request()`](#request) calls before inserting
the response html into it.

This callback will also be called when destroying any pages created by any
tabs created by this browser. There are three instances in which a content
container for a tab is destroyed and the `onDestroy()` callback called with
it:

* on a [`viewOnly`](#view-only-first-loads) load, on the view-only content
  before loading the full page.

* on a `reload()` of a page, on the current content before loading new content.

* when `back()` is called on a page.

### archiver[(tab, page)]

A function that takes a tab and a page argument and that when invoked creates
an object with `onArchive(contentCtr)` and `onRestore(contentCtr)` and
`onRestoreAfterTransition(contentCtr)` methods (all optional). The relevant
method will be called on the returned object whenever the given page is
archived/restored.

The archiver function itself will be invoked just before the page is archived.
Optionally, it is simply an object with the relevant methods.

A page is archived (taken out of the DOM) when a new page is loaded into the
tab, and restored when the page is returned to when `back()` is called on the
next page.

You'll want to do the same sort of cleaning up that you do in your
`onDestroy()` callbacks, but in a way that allows the cleaned up state to be
restored when the page is returned to.  For example:

    archiver: function(tab, page) {
      return {
        onArchive: function(contentCtr) {
          $('img', contentCtr).each(function() {
            this._src = this.src;
            return this.src = TINY_GIF;
          });
        },
        onRestore: function(contentCtr) {
          return $('img', contentCtr).each(function() {
            return this.src = this._src;
          });
        }
      };
    }

### onViewLoad/onLoad/onBack

Options for any [tab load](#tab-load) that occurs in this browser. The
`callback` options are *chained* with the browser-level callback being
executed first. The `transition` options are defaults that can be overridden
at the tab or `load()` call level.

### bundleResponders

An array of bundle responder objects.  Bundle responders are useful when you
want to render a page without having to hit the server. They're client-side
objects that handle generating [html bundle][html_bundles] responses for
requests.  You can think of them as controllers that live on the client.
Bundle responders have two properties:

* **matcher(url, parsedUrl)** - takes the url of the request in string and
parsed form as arguments and returns a `boolean` indicating whether this
responder should handle the request.

* **responder(settings, callback)** - takes the settings passed to
[`charlotte.request`](#request) (which could be a [page](#page)), and passes an
[html bundle][html_bundles] or an error back to the callback.

A trivial example of a bundle responder:

    {
      matcher: function(url, parsedUrl) {
        return parsedUrl.path === '/foobar';
      },
      respond: function(settings, callback) {
        return callback(null, {
          template: 'foobar',
          locals: {
            title: "Foobar"
          }
        });
      }
    }

## createTab(options)

The options to this method are discussed in detail in the tab API section.

## currentTab()

Returns the currently selected tab.

## switchTab(name)

Switches to the tab with the give `name`.

## getTab(name)

Returns the tab with the give `name`.

## <a id="request"></a>request(settings, callback[, renderWait, page])

Issues an [html bundle][html_bundles] request.

The `settings` are the same settings accepted by a zepto `ajax()` request,
plus:

* **viewOnly** - whether this is a view-only request

* **container** - the DOM container into which the generated HTML should be added; can
  be CSS selector or actual element object.  optional.

* **followRedirects** - override of the browser option with the same name.

* **layoutBody** - ""

* **onCacheMiss** - ""

* **onVersionChange** - ""

* **uploadOptions** - a PhoneGap
  [FileUploadOptions](http://docs.phonegap.com/en/1.5.0/phonegap_file_file.md.html#FileUploadOptions)
  object. should have a `fileUri` attribute in addition to the standard
  PhoneGap attributes. when this is option is passed, an upload using the
  PhoneGap
  [FileTransfer](http://docs.phonegap.com/en/1.0.0/phonegap_file_file.md.html#FileTransfer)
  object is done.

* **onDestroy** - same as the browser option with the same name; will be
  called on the **container** provided before adding response HTML. will be
  called before the browser callback.

* **archiver** - same as the browser option with the same name; will be called
  before the browser callback.
 
* **renderHtml** - boolean indicating whether template+bundle should be
  rendered into HTML. defaults to `true`. use this to avoid the cost of
  rendering the HTML if you're only interested in the bundle.

The `callback` is invoked when the request is complete and has this signature:

`function(err, bundle, html, triggerReady)`

* **bundle** - the [html bundle][html_bundles] object. 

* **html** - the generated html content; the same content that was loaded into
  the specified container, if specified.

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

An optional `page` argument can be passed which will be used as the context
for any ready event handlers that are executed. You should probably pass this
if you intend to invoke the `triggerReady` function.

## getVersionKey()

Returns the key used by this browser instance to access/store the current
version in `localStorage`.  Is based on the `rootUrl`.

## getAssetUrl(version, url)

Returns the versioned URL for the asset.  Returns the URL for the asset in the
filesystem cache when `charlotte.inNativeApp` is `true`.  You generally don't
need to worry about this but there are some edge cases where the abstraction
leaks and this method comes in handy, i.e. you want to set the background image
for an element dynamically to an image asset:

      var backgroundImageUrl = browser.getAssetUrl(page.version, '/img/my-background.jpg');
      page.find('#my-element').css('background-image', "url('" + backgroundImageUrl + "')");

## loadTemplates(version, paths, callback)

Loads templates specified in the `path` argument into the cache(s).  **Note:** 
this method is **not** smart about loading referenced partials.  You must
explicitly specify all templates that you want to load.

## getTemplate(version, path)

Sometimes you just want that template so you can render some html manually:

    tmpl = browser.getTemplate(page.version, "/comments/comment.jade");
    locals = _.extend({
      comment: {
        user: currentUser,
        text: text,
        createdAt: Date.now()
      }, browser.helpers);
    page.find('#comments-list').prepend(tmpl(locals)); 


# tab

In addition to the common ones, a charlotte tab has the following properties.

## createTab(options)

The `createTab()` method is actually on a browser object, but it plays the
role of constructor for a tab instance so we discuss its details here.

The `baseUrl`, `rootUrl`, and `assetRootUrl` can be provided as options. If
not provided, the tab instance will inherit those of the browser object that
created it.

`onDestroy` and `archiver` options can be provided that will will *supplement*
the browser options, and be called before them in any of the respective
scenarios in which they're called.

`onViewLoad`/`onLoad`/`onBack` options can be provided. The `callback` options
are *chained*, with the tab-level callback being executed after the
browser-level one (if the browser-level one calls `next()`). The `transition`
options override any browser-level options and serve as defaults for any loads
in this tab.

Other options are:

* **name** - a unique name for the tab.

* **container** - CSS selector identifying the container element for the tab.

* **createContentContainer** - an optional callback that should be invoked when
  creating a new content container to load a new page into.

The default createContentContainer function is:

    function defaultCreateContentContainer() {
      var container = document.createElement('div');
      container.className = 'content-container';
      container.style.display = 'none';
      return container;
    }

## <a id="tab-load"></a>load(page)

Loads a new page into the tab. A page is a basically an extension of the
settings object that zepto's `ajax()` accepts plus:

* **followRedirects** - override of the browser option with the same name.

* **onCacheMiss** - ""

* **onViewLoad** - options for the view-only load event.

* **onLoad** - options for the load event.

* **onBack** - options for the back event (loaded page is popped off the
  stack).

* **onError** - override of the `errorHandler.default` browser option. 

* **onDestroy** - supplemental to the tab and browser options with the same
  name, will be called before them.

* **preserveOnViewLoadOnRedirect** - whether to preserve the `onViewLoad`
  option if redirected to another page. defaults to `true`. set to `false` if
  you want to disable `viewOnly` loads on redirect.

* **replaceCurrent** - `boolean` indicating whether to replace the current
  page on the top of the stack with the new page.

`onViewLoad`, `onLoad`, and `onBack` all take the same options, both of
which are optional:

* **transition** - callback to handle the transition of the loaded content
  from staging container to current content container.

* **callback** - callback to be invoked when the processing of the load,
  including optional transition, is complete.

The signature for the `onViewLoad` and `onLoad` callbacks looks like:

`function(err, bundle, next[, afterViewLoad])`

* **err** - an error object if an error occurred while processing the load.

* **bundle** - html bundle response.

* **next** - a function to call to when complete. this invokes the next
  callback in the chain, or completes it. the last callback in the chain --
  the load()-level is always the last in the chain, if it exists -- can also
  pass a callback to this function to be invoked after the execution of the
  ready event handler chain is complete, though you will rarely need to do
  this. if you omit this argument in your callback signature, the next
  callback in the chain will be called immediately after.

* **afterViewLoad** - only relevant for `onLoad()`, this is `true` when the
  load event occurred after a view load.

If the `callback` option is not provided for these events, `triggerReady()`
will be automatically executed.

The `onBack` callback looks like:

`function(options, callback)`

The `options` are user-defined, and are whatever was passed in the
`tab.back()` call. The `callback` argument should be called when done doing
what it has to do.

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

Default transition functions can be defined at the browser level (see
`transitions` option to `createBrowser()`). Those defaults can be overridden
here. Setting a transition option to `null` will nullify for this load any
default transition option set at the browser level.

The value of `this` in the transition function is the current page *before*
the transition to the new page (or to the previous page in the case of
`onBack`)

### <a id="view-only-first-loads"></a>View-only first loads

Responsive user interfaces require that some sort of view be displayed to the
user upon the touch of a button, even if some latency is involved in rendering
the full content of a page. The view-only-first mechanism helps to address
that need.

When an `onViewLoad` setting is specified in a `load()` call, charlotte will
actually coordinate the handling of 2 distinct html bundle requests: 

* one request with a `viewOnly=true` query string param appended to the url
* one request with the provided url

The Express route for the url can detect this parameter with the
charlotte-provided `req.viewOnly` property and render a response immediately,
avoiding any unnecessary IO or computation:

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
`followRedirects` option is `true` (the default). When a redirect is handled
Charlotte keeps track of the original request that generated the redirect. If
the page is `reload()`-ed, the original request is attempted again as a server
state change that would affect the logic of the redirect may have occurred
since the page was originally loaded.

Charlotte also does some special things for certain kinds of redirects. If the
location being redirected to is equal to the current page (not including
search component of the urls), the tab will automatically `reload()` the
current page (with the new location, including new search component if it
exists). If it's equal to the previous page, the tab will automatically call
`back()` on itself and then `reload()` that previous page. This is useful, for
instance, in a modal form when you want the tab to automatically go back to
the previous page after posting the form and to refresh that page's contents.
Note: if the page being reloaded in either of these scenarios is itself the
result of a redirect the special handling mentioned above also applies to that
reload.

There is some magic going on to make this happen as true redirects are
transparent to XHR clients. Charlotte monkeypatches the Express
`res.redirect()` method to make these pseudo-redirects visible to the
charlotte client runtime. As long as `res.redirect()` is used to do redirects,
this behavior will be observed. Issuing a true redirect by setting a `302`
status and setting a `Location` header will bypass this magic. (Note: for
non-html-bundle requests `res.redirect()` will continue to do the normal thing
and send a `302` with a `Location` header)

### <a id="posts"></a>Posts

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

### Scroll positions

Depending on what you do in your transitions, there's a decent chance the
scroll positions of any scrolled elements on a page will be missing when it is
returned to on `tab.back()`. To allow your transitions to restore the scroll
positions when you transition the page back into the viewport, `tab.load()`
uses zepto's `data()` method to store the `scrollTop` and `scrollLeft` values
of all elements within the content container that are `.scrolled`. These
positions are stored in a hash keyed by the element ids; each position has a
`top` and `left` property. The hash itself is stored on the content container
element using zepto's `data()` under the key `scrollPositions`.

The `charlotte.pagetransitions` module makes use of these data objects to
restore scroll positions on staged content containers when transitioning them
in. Have a look there for an example of how to use this data in your own
transitions.

## reload(callback[, isRedirectFromPost])

Reloads the current page in the tab. `callback` is invoked when reload is
complete. The `isRedirectFromPost` argument is used by charlotte when it
[auto-reloads a page when posting](#posts) and should not be sent by external
callers.

## back([options, callback])

Goes back in the tab history, causing the previous page in the tab history to
be displayed. The current page will be popped from the stack and permanently
removed from the DOM. The `onBack` options for the current page --
`transition` and `callback` -- will be invoked. The `options` argument passed
as here as the first argument to `back()` will be passed to the
`onBack.callback` option that exists on the current page. When they are
complete the `callback` argument, if it exists, will be invoked. Any errors
that occurred in the `transition` or `callback` options of the page will be
passed to the `back()` callback.

The `options` argument is meant to provide a way for a page to pass data to a
previous page when it's popped.  Applications can use this to implement
updates to a page's view when it is returned to from a page that might have
updated relevant state.  **Note:** the `charlotte` property of the `options`
argument is reserved for charlotte-specific options.

## backTo(url[, options, callback])

Goes back in the tab history to the specified `url`.  Transitions between
intermediate pages are skipped and the `onBack` transition of the currently
loaded page is applied when restoring the page with the given `url`.  The
`onBack` callbacks for all intermediate pages, however, are called and the
same `options` argument is passed to each of them.

## length()

Returns the length of this tab's history.

## first()

Returns the first page loaded into this tab. 

## current()

Returns the current page in this tab.

## previous()

Returns the previous page in this tab.

## clear()

Clears all pages from this tab.

## loadInProgress()

Returns a boolean indicating whether a page load is currently in progress on
this.

# <a id="page"></a>page

A page is a basically an extension of the settings object that zepto’s ajax()
accepts. The page object includes all of the properties passed in the `load()`
call (such as `url`, `type`, etc.). In addition to those properties and the
common charlotte properties, a charlotte page has the properties below.

It's worth noting here properties in particular that maybe be useful to **set**
from your within your `ready()` event handler code include the `archiver`,
`onBack`, and `onDestroy` properties.

## NODE_ENV

The value of the `NODE_ENV` environment variable (e.g., development, production,
etc.) on the server.

## version

The version returned by the request that this page is associated with.

## index

The index of this page in the tab history. Can be useful in your view template
code when you want to do something based on where in the tab history the page
is being loaded: 

    if (context.index > 0) 
      // add a back button to the nav bar

## isAPage

Self-explanatory.  Always `true`.

## `load()`, `reload()`, `back()`, and `backTo()`

These methods delegate to the containing tab. 

If you want a page to do something different when it's reloaded you can
override the default behavior in your ready event handler or onLoad callback:

    this.reload = function(callback, isRedirectFromPost) {
      async.parallel([
        function(callback) {
          if (isRedirectFromPost) {
            refreshStatusMessage(callback);
          } else {
            callback();
          }
        },
        
        function(callback) {
          refreshSomeContent(callback);
        }
      ], callback);
    }
    

Charlotte will send a `true` value for the `isRedirectFromPost` argument when
it [auto-reloads a page when posting](#posts).

## isLoading

Whether the page is currently being loaded; is `true` until the last ready
event handler in the ready event handler chain has been executed. This can be
useful in your DOM event handlers if you only want them to do anything once
the page is fully loaded. For example, you may have an event handler that
applies styling to a back button when it's tapped but if you invoke `back()`
on a page while it is still loading it will be ignored, leaving the styling in
place on the button but the page not popped. You can check `page.isLoading` before
applying the styling:

    page.on('touchstart', '.button.back', function(e) {
      if (!page.isLoading) {
        $(this).addClass('tapped');
      }
    });


This is a new property that probably makes more sense to keep transparent --
i.e., if you use `page.on()` to attach your event handlers it will
transparently ignore or block events until the page is fully loaded. May do
that in the future but for now you have this property to use if you need it.

## tab
 
The tab that this page was loaded into.

## browser

The browser that created the tab that this page was loaded into.

# Error Handling

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

`function(err, page)`

* **err** - the error.

* **page** - the page the error occurred on if it occurred on a page load.

The global handler is always invoked for every error that occurs on a browser
request or tab load, and is the first to be invoked. The next error handler in
the chain will always be called immediately after the global is invoked, so no
callback is passed to it.

Next in line is the default error handler:

`function(err, page, next)`

It takes the same arguments as the global handler plus a callback that can be
optionally invoked to pass the error down to the next handler in the chain.
The default error handler can be overridden on a tab load by specifying an
**onError** setting.

Finally, if the `next` callback is invoked in the default or settings.onError
handler, the request-level callback will be invoked and passed the error as
the first argument.

## <a id="error-types"></a>Error Types

Charlotte will generate the errors of the types below to handle certain
internal exceptions encountered while processing a request. You can check for
these in your error handlers to handle these specific error conditions. For
all other errors, including `500` responses, a simple `Error` will be
generated.

    if (err instanceof charlotte.ServerUnavailableError) {
      alert("Server is unavailable");
    } else if (err instanceof charlotte.ResourceNotFoundError) {
      alert("Couldn't find that. Maybe it got deleted?");
    ...

Each of the error types below extend the `Error` object, and inherit
properties like `name` and `message`. 

### charlotte.ServerUnavailableError

Generated in any of the following situations:

* host is unreachable.

* connection cannot be established with server.

* the server responds with 503 status.

* request times out.

Additional properties:

* **url** - url of resource request was made for.

### charlotte.ResourceNotFoundError

Generated when the server responds with a 404 status.

Additional properties:

* **url** - url of resource request was made for.

### charlotte.RedirectError

Generated when the server redirects and `followRedirects` is false.

Additional properties:

* **location** - the location being redirected to.

### charlotte.AssetLoadError

Generated when an error occurs loading javascripts or stylesheets.

# Chain, Chain, Chain

A number of different callback chains have been discussed in this document and
it's easy to get lost without understanding their relationship to eachother.
It's quite simple. The error handlers chain leads into the tab load callback
chain leads into the ready event handler chain:

    [error handler chain ->] [tab load callback chain ->] ready event handler chain [-> post-ready callback]

The error handler chain only exists if the relevant options are set. The tab
load callback chain only applies for tab loads and is not included in any
direct browser requests. At any point, any individual chain and thus the
overall chain can be broken by not invoking the appropriate "next" callback
(except for the `global` error handler at the start of the chain which does
not need to invoke a next callback).

The callback passed to `next()` in the final tab load callback, if passed, is
called after the ready event handler chain.

# `completeBundleProcess`

Normally a server error will abort normal request processing and generate an
`Error` that will be passed along the error handler chain. The server can
prevent this from occurring by sending back a valid html bundle with a
`completeBundleProcess` property set to `true`:

    app.error(function(err, req, res){
      res.render('500', {
         error: err,
         completeBundleProcess: true
      });
    });
    

In this case, no `Error` will be generated in the Charlotte client, the bundle
will be processed as usual, and the error page sent by the server will be
displayed. Note that this example merely extends the [example from the Express
Guide](http://expressjs.com/guide.html#error-handling) by adding the
`completeBundleProcess` flag. Here again we're leveraging code written to
handle normal web requests by extending it to work in html bundle mode.

# charlotte.util

## Utility methods

* **propertyHelper()** - this method can be used to create request scope
  properties that can be set and accessed from templates. this allows a
  template used to render the body of a response to set a property used by the
  layout body that includes it, i.e. where the cancel link should point to in
  the modal form layout body.

* **isBlank(varName)** - return true if the variable named *varName* in `this`
  scope is `undefined`, `null`, or an empty string.

* **parseUrl(url)** - parses the *url* and returns an object with
  [attributes](http://dev.w3.org/html5/spec/urls.html#url-decomposition-idl-attributes).

* **parseBundle(url)** - parses an HTML bundle, automatically converting
  UTC-formatted date strings into Date objects.

* **storeScrollPositions(contentContainer, tabContainer)** - store positions of
  scrolled elements in a way that can be restored by `restoreScrollPositions()`.
  `tabContainer` should be a selector.

* **restoreScrollPositions(contentContainer)** - restore positions of scrolled
  elements that were stored by `storeScrollPositions()`.

## semanticVersion(versionString)

Parses a [semantic version](http://semver.org/) string and returns an object
with these properties and methods:

* **major** - the major version

* **major** - the minor version

* **major** - the patch version

* **preRelease**  - the pre-release identifier

* **build** - the build metadata

* **toString()** - returns the string representation of the version.

* **compareTo(that)** - compares `this` version to `that`. returns -1 if
  `this` is less than `that`, 0 if they're equal, and 1 if `this` is greater
  than `that`.

* **depthEqualTo(that)** - the depth to which `this` is equal to `that`. "1.0.1"
  is equal to "1.0.2" to a depth of 2 but only equal to "1.1.0" to a depth of 1.
  **note: "1.0" is equal to "1.0.0" to a depth of 3.  and "1.0.0+1" is equal
  to "1.0.0+1" to depth of 5.**

* **isPatchOf(that)** - returns `true` if `this` is a patch of `that` (i.e.
  2.1.2 is a patch of 2.1.0 and 2.1.1, but not 2.0 or 2.1.3)

* **isBuildUpdateOf(that)** returns `true` if this is a later build of the same
  release or pre-release version.

## VersionMismatchError(localVersion, remoteVersion[, message]) 

Constructor for an `Error` representing a mismatch between the version
retrieved from local storage and the version returned from the server. Has a
`localVersion` and `remoteVersion` property in addition to the base `Error`
properties.

Intended for use in `onVersionChange` handlers to be passed to the error
callback chain.

# charlotte.pagetransitions

To get started with your app, you can use some of the basic animations
provided in this module in your page transition functions. You'll probably
want to write your own custom animations for your own app.

Check the
[source](https://github.com/danieldkim/charlotte/blob/master/lib/page_transitions.js)
for inline JSDoc API documentation.

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

Versioning is server-driven and is enabled by setting the `charlotte.version`
property on the `charlotte` node module. This is used in a few different ways
in the Express environment:

* a '/version' route is created that returns this value.

* the template asset helpers use this value to auto-version all urls.

* the `version()` dynamic helper returns this value.

* it is included in every html bundle sent from this ever.

### onVersionChange(localVersion, remoteVersion, callback)

When versioning is enabled, the server side of Charlotte includes a `version`
in every html bundle that it sends. The Charlotte client compares this version
to the existing version stored in local storage and will call the
`onVersionChange` handler if they're different.

The handler should call the passed `callback` argument to continue request
processing. If an error is passed to the callback, request processing will be
aborted and the error will passed to the error handler chain. If no error is
passed, the local storage version will be updated with the new remote version
and request processing will proceed normally.

If you are using semantic versions, this is a reasonable way to implement this
handler:

    onVersionChange: function(localVersion, remoteVersion, callback) {
      var semanticVersion = charlotte.util.semanticVersion,
          localSemVer = localVersion ? semanticVersion(localVersion) : null,
          remoteSemVer = semanticVersion(remoteVersion);
      console.log("Version changed! local: " + localVersion + ", remote: " + remoteVersion);
      // if new version is not just a patch, send VersionMismatchError
      callback(localSemVer && remoteSemVer.isPatchOf(localSemVer) ? 
                 null : 
                 new charlotte.util.VersionMismatchError(localSemVer, remoteSemVer));
    }

We use `charlotte.util.semanticVersion` to parse the version strings and
compare them. If the remote version is just a patch of the local version, we
call the `callback` with no error to continue normal request processing.
Otherwise, we create a new `charlotte.util.VersionMismatchError`, passing in
the semantic version objects to the constructor. We can then check for the
`charlotte.util.VersionMismatchError` in an error handler and take appropriate
action.  This is how we might handle it in our error handler:

    if (err instanceof VersionMismatchError) {
      var localVersion = err.localVersion, 
          remoteVersion = err.remoteVersion
      if (localVersion.compareTo(remoteVersion) > 0) { // local is greater
        // app store update downloaded before new server version 
        // deployed. notify user to try again later.
        alert("New version of app not live yet.  Please try again later.");
      } else { 
        if (localVersion.major != remoteVersion.major) {
          // major version update, need app store update
          alert("Please update to latest version available in the app store.");
        } else if (localVersion.minor != remoteVersion.minor) {
          // minor version update, update local version and restart
          localStorage.setItem("version", remoteVersion);
          alert("Restart required to update.  Restarting now ...")
          document.location = "index.html";
        }
      }
    } 


## Filesystem Cache

Charlotte uses the [PhoneGap File
API](http://docs.phonegap.com/en/1.5.0/phonegap_file_file.md.html) to cache
resources locally. The root directory for the cache `res_cache` and is
organized by root url/version/resource host.

For example, here's what the [charlotte demo][demo] cache directory tree looks
like:

    |-res_cache
    |---local.charlottedemo.com_3000_
    |-----1.0
    |-------local-assets.charlottedemo.com_3000
    |---------versions
    |-----------1.0
    |-------------lib
    |---------------charlotte
    |---------------common
    |-------------messages
    |-------------posts
    |-------------tab_menu
    |-------------users
    |-------local.charlottedemo.com_3000
    |---------posts
    |-----------new
    |---------tab_menu
    |---------view_only_bundles

You can see that the directory structure under
`local.charlottedemo.com_3000_/1.0/local-assets.charlottedemo.com_3000`
mirrors that of the `views` directory on the server. It, is in fact a mirror
of the server:

![](https://img.skitch.com/20120502-k7h79xuxrctdag1t21jqtk77q7.jpg)

The directory structure under
`local.charlottedemo.com_3000_/1.0/local-assets.charlottedemo.com_3000`
matches the Express route hierarchy (for those html bundle resources that are
cached locally).

![](https://img.skitch.com/20120502-kmr74h9refdcc4ay4wxhn78tu2.jpg)

Bundles are stored as json files. For the resource with url `/foo/bar`, the
bundle would be stored in `foo/bar/index.json`. Query strings gets translated
into strings that can contribute to legal filenames, so `foo/bar?baz=qux`
would be stored under `foo/bar__qm__baz__eq__qux.json`.

View-only bundles are stored in a separate directory and with a filename based
on the key they are registered under, plus query string.

You can delete any file individually in the filesystem cache and charlotte
will automatically refresh it (this will generate a **cacheMiss** event). You
can also edit a file directly in the cache if you wish. The changes will not
be reflected in the running app, however, until the app is restarted due to
the RAM cache ...

## RAM Cache

All resources that are cached in the filesystem are also cached in memory.
Once read from the filesystem Charlotte will not have to go to it again for a
particular resource until the app is evicted from memory.

### Temp cache

There is one set of resources that is *only* cached in memory and not
permanently in the filesystem. These resources are specified by the
`cachedBundes.tempUrlMatchers` browser option. The local cache for the such
resources lives only as long as the app is active in main memory.

The overall size of this cache can be controlled with the
`charlotte.tempCacheSize` property. Temp cache sizes cannot be controlled at
the individual browser instance level. Older cache entries will be removed to
make room for newer ones when the cache size is exceeded.

## Resource types

### Templates

### JavaScripts

### Stylesheets

### Images

### Html Bundles

## Disabling Caching for Development

Caching can be disabled very simply by disabling versioning, which setting
`charlotte.version` to a falsy value will accomplish. When `charlotte.version`
is falsy, Charlotte caches will never be consulted and every resource request
will generate a real browser request against the server.

**Note:** this does nothing to defeat any normal web caching that you're doing
outside of Charlotte. i.e., if an `Expires` header was set with a date in the
future, then the desktop browser or WebView could still serve a cached version
out of *its* cache.

This can be useful in development. With caching disabled, a page reload in a
charlotte tab will load all resources again from the server. Gotchas with
this when loading pages in html bundle mode:

* only additive or overwriting changes will take effect. i.e., removing a
  style in a stylesheet on the server will not cause that style to be removed
  from the DOM when the page is reloaded. an app restart is required for
  deletions to take effect even with caching disabled (for a simulation
  index.html file in a desktop browser a restart is just a true browser reload
  of the index.html file).

* though old script tags are removed from the DOM when caching is disabled,
  they do not get removed from the list of scripts on the Scripts panel in the
  Developer Tools in Chrome. you end up with lots of duplicates in the list
  very quickly as you click around in your app. this can make it difficult to
  find the right script to set a breakpoint in. for this reason, you'll
  probably want to enable caching when you need to use the debugger. **Note**:
  inline scripts are used in non-Chrome environments when caching is disabled.
  these do not even appear at all in the Scripts panel in Web Inspector
  desktop Safari.


## Versioned Asset Deployment

As you deploy new server versions across your cluster, there will a period of
time when some nodes in your cluster are on the new version and some are on
the old, until all the nodes are updated. To ensure that the correct version
of the assets are always available for any given request during this time
deploy the new assets ahead of the new server version, while continuing to
serve the previous/existing version of the assets. Once the new assets are
fully deployed, propagated through your CDN, etc. then begin deploying the new
server version. This means that for production, `/views/versions/1.0` cannot
just be a symlink to `/views' but should be a full copy of it. Once the new
server version is completely deployed across all nodes you can delete the
previous version.


## <a id="cache-seed"></a>Cache Seed

If Charlotte cannot find a resource in the memory or in the filesystem cache,
it will look in the cache seed location before requesting the resource from
the server. Thus the order of locations Charlotte looks for a resource in is:

    RAM -> filesystem -> cache seed -> server

The cache seed can be used to ship assets and html bundles with your native
app distribution. This can allow the app to function even if started for the
first time when offline. In fact, you **should** put at a bare minimum enough
in the cache seed to at least display the view-only version of the home page
and a user friendly message if the server is unreachable when the app is
initially booted. You'll probably want to put more than the bare minimum to
minimize the time it takes to initially boot the app even when online.

The default cache seed location is `./cache_seed`, which would be
`www/cache_seed` in your PhoneGap app. 

The structure of the cache seed mirrors that of the filesystem cache (it
should contain the same top-level directory for all the cached assets, which
in the current version of charlotte is `/res_cache`). To determine exactly
what content to put into your cache seed, you can simply run your app in the
iOS simulator with versioning/caching enabled, hitting the pages that you want
to be bundled with the app. Then copy the relevant directories and files over
to the cache seed location.

### Initialize the version in `localStorage`

Charlotte uses a `localStorage` item to keep track of the current version of
the app. When the app is booted for the first time after initial installation
this value will not exist in `localStorage`. Charlotte will attempt to
retrieve the current version from the server in this case. If the app is
offline when initially booted, however, it will have no way of determining the
current version and will thus use non-versioned asset urls -- and thus will
not find the assets you've shipped in the cache seed.

To prevent this, simply do something like this in your app boot script before
you do anything else with charlotte:

    charlotte.rootUrl = 'http://foo.com';
    // versionKey is based on rootUrl
    var versionKey = charlotte.getVersionKey();
    if (!localStorage.getItem(versionKey)) {
      localStorage.setItem(versionKey, "1.0");
    }

You'll have to do the same for any browser instances that you create on boot
that have a different `rootUrl` than the global `charlotte` object.

### Binary files in the cache seed

One caveat for binary files is that they must be specified in a manifest. This
is because there is currently no way to transfer/copy binary files from the
app bundle to the cache location.

For example, if you have a file that gets stored in the cache location at
`/res_cache/foo.com/1.0/assets.foo.com/versions/1.0/img/icons/bar.png` you
should set the `cacheSeedBinaryFiles` option on charlotte like so:

    charlotte.cacheSeedBinaryFiles = [
      '/res_cache/foo.com/1.0/assets.foo.com/versions/1.0/img/icons/bar.png'
    ];

I know this solution is less than ideal but, until I have time to work on a
better one, it works.

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

* the `flash()` method will work slightly differently when running in html
  bundle mode app than it does when running in node. flash messages will only
  be accessible in a native app on the immediately subsequent request, after
  which they will be cleared even if not accessed during that request. that
  also means they will not be accessible on the same request that they are
  created. this fits with the general use case for the `flash()` method; your
  app should not depend on support for other use cases.

# SSL support

There is some support for handling SSL transparently in the server while
specifying a non-SSL `rootUrl` and `assetRootUrl` option for charlotte.  When
executing on the server the helpers will output URL's appropriately depending on
whether the current request is https or not.

On the client, you need to take care of setting up the charlotte object with the
appropriate `rootUrl` and `assetRootUrl`, https or not.  Mixing http and http
requests in an HTML bundle mode session is not supported yet, though some
preliminary work has been done to support it.  All requests will be either/or --
`requestIsSecure` will be a constant value for every HTML bundle request within
a given session.


[demo]: https://github.com/danieldkim/charlotte_demo  "Charlotte demo"

[html_bundles]: https://github.com/danieldkim/charlotte/wiki/Html-Bundles "HTML Bundles"
