(function() {
  var shared = {},
      HTML_BUNDLE_MIME_TYPE = "application/x-html-bundle+charlotte",
      urlModule;

  if (typeof require !==  'undefined' && require('url')) {
    urlModule = require('url');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = shared;
  } else {
    this.charlotte = this.charlotte || {};
    this.charlotte.shared = shared;
  }
  
  function parseUrl(url) {
    var parsed;
    if (urlModule) {
      parsed = urlModule.parse(url);
    } else if ('undefined' !== typeof window) {
      parsed = document.createElement('a');
      parsed.href = url;
      parsed.path = parsed.pathname;
    } else {
      throw new Error("Can't parse url, don't know where the hell I am.");
    }
    return parsed;
  };

  function removeMultislashes(s) {
    return s.replace(/([^:])\/{2,}/g, '$1/').
             replace(/^\/{2,}/, '/');
  }

  function removeUrlMultislashes(url) {
    if (url.match(/^(file|http|https)\:/)) {
      var parsedUrl = parseUrl(url);
      parsedUrl.pathname = removeMultislashes(unescape(parsedUrl.pathname));
      if (urlModule) {
        return urlModule.format(parsedUrl);
      } else {
        return parsedUrl.href;
      }
    } else {
      return removeMultislashes(url);
    }
  }

  shared.HTML_BUNDLE_MIME_TYPE = HTML_BUNDLE_MIME_TYPE;
  
  shared.parseUrl = parseUrl;
  shared.removeUrlMultislashes = removeUrlMultislashes;
  
  var globalObj;
  if ('undefined' !== typeof global) globalObj = global;
  else if ('undefined' !== typeof window) globalObj = window;
  else throw new Error("Unknown global object.");
  shared.isBlank = function(varName, globally) {
    with(this) {
      var theVarIsBlank = eval("(" + 
                      '"undefined" === typeof ' + varName +  
                      '|| ' + varName + ' === null || ' +
                      varName + ' === "" )');
      if (globally) {
        return theVarIsBlank;
      } else {
        return theVarIsBlank || eval('(' + varName + ')') === globalObj[varName];
      }
    }
  };
  
  shared.normalizeStylesheetUrl = function(baseUrl, url) {
    if (url.match(/^\//)) return url; // root-relative needs no transformation
    if (baseUrl.match(/\.css$/)) baseUrl = baseUrl.replace(/\/[^\/]+$/, '');
    url = url.replace(/^\.\//, '');
    while (url.match(/^\.\./)) {
      baseUrl = baseUrl.replace(/\/[^\/]+$/, '');
      url = url.replace(/^\.\.\//, '');
    } 
    return removeUrlMultislashes(baseUrl + '/' + url);
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
    return server + removeMultislashes("/versions/" + version + "/" + path);
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

  shared.parseBundle = function(data) {
    return JSON.parse(data, function (key, value) {
      if (typeof value != 'string') return value;
      var isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).(\d{3})Z$/);
      if (isoMatch) {
        var date = new Date();
        date.setUTCFullYear(isoMatch[1]);
        date.setUTCMonth(isoMatch[2]-1);
        date.setUTCDate(isoMatch[3]);
        date.setUTCHours(isoMatch[4]);
        date.setUTCMinutes(isoMatch[5]);
        date.setUTCSeconds(isoMatch[6]);
        date.setUTCMilliseconds(isoMatch[7]);
        return date;
      } else return value;
    });
  }
    
}).call(this);