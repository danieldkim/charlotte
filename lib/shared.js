(function() {
  var shared = {},
      HTML_BUNDLE_MIME_TYPE = "application/x-html-bundle+charlotte";

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = shared;
  } else {
    this.charlotte = this.charlotte || {};
    this.charlotte.shared = shared;
  }
  
  function removeUrlMultislashes(url) {
    return url.replace(/([^:])\/{2,}/g, '$1/').
               replace(/^\/{2,}/, '/');
  }

  shared.HTML_BUNDLE_MIME_TYPE = HTML_BUNDLE_MIME_TYPE;
  
  shared.removeUrlMultislashes = removeUrlMultislashes;
  
  shared.isBlank = function(varName, globally) {
    with(this) {
      var theVarIsBlank = eval("(" + 
                      '"undefined" === typeof ' + varName +  
                      '|| ' + varName + ' === null || ' +
                      varName + ' === "" )'),
          globalObj;
      if ('undefined' !== typeof global) globalObj = global;
      else if ('undefined' !== typeof window) globalObj = window;
      else throw new Error("Unknown global object.");
      if (globally) {
        return theVarIsBlank;
      } else {
        return theVarIsBlank || eval('(' + varName + ')') === globalObj[varName];
      }
    }
  };

  // should only be used with absolute urls because the browser implementation 
  // of this does (using an anchor element) does something different than 
  // the node's url module
  shared.parseUrl = function(url) {
    var parsed;
    if (!url.match(/^http/)) throw new Error("Can only parse absolute url's.");
    if ('undefined' !== typeof global) {
      parsed = require('url').parse(url);
    } else if ('undefined' !== typeof window) {
      parsed = document.createElement('a');
      parsed.href = url;
      parsed.path = parsed.pathname;
    } else {
      throw new Error("Can't parse url, don't know where the hell I am.");
    }
    return parsed;
  };
  
  shared.resolveUrl = function(rootUrl, url) {
    if (url.match(/^http/)) return url;
    
    if (url.match(/^file/)) url = url.substring(7);
    return removeUrlMultislashes(rootUrl + url);
  };
  
  shared.versionAssetUrl = function(version, url) {
    if (!version) return url;
    var path, parsedUrl, server = '';
    if (!url.match(/^http/)) {
      path = url;
    } else {
      parsedUrl = this.parseUrl(url);
      path = parsedUrl.path;
      server = parsedUrl.protocol + '//' + parsedUrl.host;
    }
    return server + removeUrlMultislashes("/versions/" + version + "/" + path);
  };
  
  shared.tag = function(name, urlAttr, urlMapper, options) {
    var s, url = urlMapper(options[urlAttr]);
    
    if (!url) return '<!-- skipping tag with url: ' + options[urlAttr] + ' -->';
    
    s = '<' + name + ' ';
    _.each(options, function(v,k) {
      v = (k == urlAttr ? url : v);
      s += k + '="' + v + '" ';
    });
    s += '></' + name + '>';
    return s;
  };

  shared.tags = function(name, urlAttribute, urlMapper, baseOptions, helperArgs) {
    var lastHelperArg = helperArgs[helperArgs.length-1],
        options = _.extend({}, baseOptions),
        tags = [], 
        end = helperArgs.length;
    if (_.isObject(lastHelperArg)) {
      _.extend(options, lastHelperArg);
      end -= 1;
    }
    for (var i = 0; i < end; i++) {
      options[urlAttribute] = helperArgs[i];
      tags.push(this.tag(name, urlAttribute, urlMapper, options));
    }
    return tags.join('\n'); 
  };
    
}).call(this);