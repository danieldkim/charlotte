(function() {

  var util = {}, shared;
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = util;
    shared = require('./shared');
  } else {
    this.charlotte.util = util;
    shared = this.charlotte.shared;
  }
  
  var SEMANTIC_VERSION_LEVELS = [
  'major', 'minor', 'patch', 'preRelease', 'build'
  ];
  util.semanticVersion = function(versionString) {
    var partsMatch = versionString.match(/^([\d\.]+)(\-[^-+]+|$)?(\+[^+]+)?/),
        version = partsMatch[1],
        preRelease = partsMatch[2],
        build = partsMatch[3],
        versionParts = version.split('.'),
        major = parseInt(versionParts[0]), 
        minor = parseInt(versionParts[1]||0), 
        patch = parseInt(versionParts[2]||0);

    if (preRelease) preRelease = preRelease.slice(1);
    if (build) build = build.slice(1);
    return {
      major: major,

      minor: minor,

      patch: patch,

      preRelease : preRelease,

      build : build,
      
      toString: function() {
        return versionString;
      },
      
      compareTo: function(that) {
        if (this.major < that.major) return -1;
        else if (this.major > that.major) return 1;
        else { // major versions equal
          if (this.minor < that.minor) return -1;
          else if (this.minor > that.minor) return 1;
          else { // minor versions equal
            if (this.patch < that.patch) return -1;
            else if (this.patch > that.patch) return 1;
            else { // patch versions equal
              if (this.preRelease && that.preRelease) { // both are pre-releases
                if (this.preRelease < that.preRelease) return -1;
                else if (this.preRelease > that.preRelease) return 1;
                else { // preRelease versions equal
                  if (this.build < that.build) return -1;
                  else if (this.build > that.build) return 1;
                  else return 0;
                }
              } else if (this.preRelease) {
                // this is a pre-release, but that can't be, so that's greater
                return -1;
              } else if (that.preRelease) {
                // that is a pre-release, but this can't be, so this greater
                return 1;
              } else { // neither are pre-releases
                if (this.build && that.build) { // both have build metadata
                  if (this.build < that.build) return -1;
                  else if (this.build > that.build) return 1;
                  else return 0;
                }
              }
            }
          }
        }
      },
      
      depthEqualTo: function(that) {
        var depth = 0,
            p;
        for (var i = 0; i < SEMANTIC_VERSION_LEVELS.length; i++) {
          p = SEMANTIC_VERSION_LEVELS[i];
          if (this[p] == that[p]) depth++;
          else break;
        }
        return depth;
      },
      
      isPatchOf: function(that) {
        return this.depthEqualTo(that) == 2 && this.patch > that.patch;
      },

      isBuildUpdateOf: function(that) {
        return this.depthEqualTo(that) == 4 && 
          ((!_.isUndefined(this.build) && _.isUndefined(that.build)) ||
            this.build > that.build); 
      }
    };    
  }
  
  var VersionMismatchError = util.VersionMismatchError = function(localVersion, remoteVersion, message) {  
      this.name = "VersionMismatchError";
      this.localVersion = localVersion;
      this.remoteVersion = remoteVersion;
      this.message = message || "Version mismatch. local version: " + localVersion + ", remote version: " + remoteVersion;  
  }  
  VersionMismatchError.prototype = new Error();  
  VersionMismatchError.prototype.constructor = VersionMismatchError;

  // from http://stackoverflow.com/questions/3601080/how-do-i-pass-content-from-a-template-to-a-layout-in-express
  util.propertyHelper = function() {
    return function() {
      var value = null;
      return {
        get: function () {
          return value;
        },
        set: function (new_value) {
          value = new_value;
        }
      };
    }
  };
  
  util.resolveAttrUrl = function(url) {
    if (url.match(/^file/)) return url.substring(7);
    else return url;
  };
  
  util.storeScrollPositions = function(contentContainer, tabContainer) {
    scrollPositions = {};
    $('.scrolled', contentContainer).each(function() {
      scrollPositions[this.id] = { top: this.scrollTop, left: this.scrollLeft }
    });
    $(contentContainer).data('scrolledTabContainer', tabContainer);
    $(contentContainer).data('scrollPositions', scrollPositions);

  }

  util.restoreScrollPositions =   function(el) {
    if ($(el).data('scrollPositions')) {
      var scrolledTabContainer = $(el).data('scrolledTabContainer')
      _.each($(el).data('scrollPositions'), function(pos, id) {
        var scrolledEl = $(scrolledTabContainer + ' #' + id)[0];
        scrolledEl.scrollTop = pos.top;
        scrolledEl.scrollLeft = pos.left;
      });
    }    
  }

  util.parseBundle = shared.parseBundle;

  util.removeUrlMultislashes = shared.removeUrlMultislashes;
  
  util.isBlank = shared.isBlank;
  
  util.parseUrl = shared.parseUrl;
  
}).call(this);
