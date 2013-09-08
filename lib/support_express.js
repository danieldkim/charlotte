var http = require('http'),
    version,
    _ = require('underscore'),
    shared = require('./shared'),
    util = require('./util'),
    rootUrl,
    secureRootUrl,
    assetRootUrl,
    secureAssetRootUrl,
    viewExtensions,
    defaultViewExtensions = ['jade', 'css', 'js', 'jpg', 'gif', 'png'];

function tagUrlMapper(url, secure) {
  return shared.resolveUrl(assetRootUrl, shared.versionAssetUrl(version, url), 
           secure);
}

function createTagUrlMapper(secure) {
  return function(url) {
    return tagUrlMapper(url, secure);
  };
}

exports.util = util;
exports.shared = shared;

Object.defineProperty(exports, "version", {
  get : function(){ return version; },  
  set : function(s){ version = s; }
});

Object.defineProperty(exports, 'viewExtensions', {
  get: function() {
    return viewExtensions;
  },
});

function setViewExtensions(extensions) {
  if (extensions == 'default') viewExtensions = defaultViewExtensions;
  else viewExtensions = extensions;
}

Object.defineProperty(exports, 'templateExtensions', {
  get: function() {
    return viewExtensions;
  },
});

function setTemplateExtensions(extensions) {
  viewExtensions = viewExtensions.concat(Array.prototype.slice.call(arguments));
}
                                
exports.supportExpress = function(app, options) {
  options = options || {};
  var req = http.IncomingMessage.prototype,
      oldFlash = req.flash,
      res = http.ServerResponse.prototype,
      oldRender = res.render,
      oldRedirect = res.redirect;
      
  rootUrl = options.rootUrl || "/";
  secureRootUrl = rootUrl.replace(/^http:/, 'https:');
  assetRootUrl = options.assetRootUrl || "/";
  secureAssetRootUrl = assetRootUrl.replace(/^http:/, 'https:');
  if (options.viewExtensions) setViewExtensions(options.viewExtensions);
  if (options.templateExtensions) setTemplateExtensions(options.templateExtensions);

  Object.defineProperty(req, 'referer', {
    get: function() {
      return this.header('X-Referer') || this.param('X-Referer') || this.header('Referer') ;
    }
  });

  Object.defineProperty(req, 'viewOnly', {
    get: function() {
      var p = this.param('viewOnly');
      return p == 'true' || p == '1' || p == 'yes';
    }
  });
  
  req.flash = function() {
    this.__flashCalled = true;
    return oldFlash.apply(this, arguments);      
  };
  
  res.render = function() {
    var flash, 
        pathname =  require('url').parse(this.req.url).pathname,
        locals = arguments[1];
    
    if (this.req.__isHtmlBundleRequest) {
      var bundle = {
        NODE_ENV: process.env.NODE_ENV,
        template: arguments[0],
        locals: _.extend({}, this._locals || {}, locals)
      };
      if (version) bundle.version = version;
      if (!this.req.__flashCalled) {
        flash = this.req.flash();
        if (Object.keys(flash).length > 0) bundle.flash = flash;
      }
      this.send(bundle, locals && locals.status ? locals.status : undefined);
    } else {
      return oldRender.apply(this, arguments);
    }
  };  
      
  app.use(function(req, res, next) {

    if (req.header('Accept') === shared.HTML_BUNDLE_MIME_TYPE ||
        req.param('Accept') === shared.HTML_BUNDLE_MIME_TYPE ||
        require('url').parse(req.url).pathname.match(/\.hb.charlotte$/) ) {
      req.__isHtmlBundleRequest = true;
      var end = res.end;
      res.end = function() {
        res.end = end;
        if (!this.__redirectCalled) {
          return end.apply(this, arguments);
        }
        // don't let this response end if redirect is calling it
        // cuz we're gonna monkey with it
      };
      res.redirect = function() {
        this.__redirectCalled = true;
        oldRedirect.apply(this, arguments);
        this.send({Location: this.header('Location')}, 200);
      };
    }
    
    next();
  });

  var helpers = {
    isBlank: shared.isBlank
  };
  
  _.each({
    // link: 'href', 
    // script: 'src',
    img: 'src'
  }, function(urlAttr, name) {
    helpers[name] = function(options) {
      return shared.tag(name, urlAttr, tagUrlMapper, options);
    };
  });
  
  _.extend(helpers, {
    assetUrl: function(url) {
      return tagUrlMapper(url, this.requestIsSecure);
    },
    
    stylesheets: function() {
      var urls = _.isArray(arguments[0]) ? arguments[0] : arguments;
      urls = _.map(urls, function(arg) { return arg + '.css';});
      return shared.tags('link', 'href', 
                         createTagUrlMapper(this.requestIsSecure),
                         {rel: "stylesheet", type: "text/css"},
                         urls);
    },
    
    javascripts: function() {
      var urls = _.isArray(arguments[0]) ? arguments[0] : arguments;
      urls = _.map(urls, function(arg) { return arg + '.js';});
      return shared.tags('script', 'src', 
                         createTagUrlMapper(this.requestIsSecure),
                         {type:"text/javascript"},
                         urls);
    }
  });
  
  app.helpers(helpers);
  
  app.dynamicHelpers({
    NODE_ENV: function() {
      return process.env.NODE_ENV;
    },
     
    context: function() {
      return app;
    },
    
    rootUrl: function(req, res) {
      return req.secure ? secureRootUrl : rootUrl;
    },

    assetRootUrl: function(req, res) {
      return req.secure ? secureAssetRootUrl : assetRootUrl;
    },
    
    version: function() {
      return version || '';
    },
    
    requestId: function() {
      return null;
    },
    
    viewOnly: function(req, res) {
      return req.viewOnly;
    },
    
    referer: function(req, res) {
      return req.referer;
    },
    
    inNativeApp: function() {
      return false;
    },

    requestIsSecure: function(req, res) {
      return req.secure;
    }
  });  

  app.get('/version', function(req, res) {
    res.header('Content-Type', 'text/plain');
    res.send(version);
  });
  
  if (viewExtensions) {
    viewExtensions.forEach(function(ext) {
      app.get('*.' + ext, function(req, res, next) {
        res.sendfile(req.url.path);
      });    
    });
  }
  
};
