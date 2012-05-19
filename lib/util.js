(function() {

  var util = {}, shared;
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = util;
    shared = require('./shared');
  } else {
    this.charlotte.util = util;
    shared = this.charlotte.shared;
  }
  
  util.semanticVersion = function(versionString) {
    var parts = versionString.split('.'), 
        major = parseInt(parts[0]), 
        minor = parseInt(parts[1]||0), 
        patch = parseInt(parts[2]||0);

    return {
      major: major,

      minor: minor,

      patch: patch,
      
      toString: function() {
        return versionString;
      },
      
      compareTo: function(that) {
        if (this.major < that.major) {
          return -1;
        } else if (this.major > that.major) {
          return 1;
        } else { // major versions equal
          if (this.minor < that.minor) {
            return -1;
          } else if (this.minor > that.minor) {
            return 1;
          } else { // minor versions equal
            if (this.patch < that.patch) {
              return -1;
            } else if (this.patch > that.patch) {
              return 1;
            } else { // patch versions equal
              return 0;
            }
          }
        }
      },
      
      isPatchOf: function(that) {
        return this.major == that.major &&
               this.minor == that.minor &&
               this.patch > that.patch;
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
  
  util.removeUrlMultislashes = shared.removeUrlMultislashes;
  
  util.isBlank = shared.isBlank;
  
  util.parseUrl = shared.parseUrl;
  
}).call(this);
