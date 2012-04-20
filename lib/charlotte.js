(function() {

  var charlotte,
      inNativeApp = window.Cordova ? true : false,
      RES_CACHE_ROOT = '/res_cache',
      FILE_ERROR_MESSAGES = {},
      FILE_ERROR_CONST_NAME_TO_STR_MSG_MAP = {
        'NOT_FOUND_ERR': 'Not found error',
        'SECURITY_ERR': 'Security error',
        'ABORT_ERR': 'Abort error',
        'NOT_READABLE_ERR': 'Not readable error',
        'ENCODING_ERR': 'Encoding error',
        'NO_MODIFICATION_ALLOWED_ERR': 'No modification allowed error',
        'INVALID_STATE_ERR': 'Invalid state error',
        'SYNTAX_ERR': 'Syntax error',
        'INVALID_MODIFICATION_ERR': 'Invalid modification error',
        'QUOTA_EXCEEDED_ERR': 'Quota exceeded error',
        'TYPE_MISMATCH_ERR': 'Type mismatch error',
        'PATH_EXISTS_ERR': 'Path exists error'
      },
      ASSET_METHOD_NAMES = ['assets', 'stylesheets', 'javascripts', 'require'],
      ServerUnavailableError, AssetLoadError,
      htmlBundleMode,
      cacheSeedLocation,
      modules = {},
      readyRegistry = {},
      readyRegistryTimestamps = {},
      readyRegistryTimeToLive,
      baseUrl,
      rootUrl,
      assetRootUrl,
      shared,
      fileFullPathRoot,
      fileUrlCache = {},
      resourceCache = {},
      tempCache = {},
      tempCacheQueue = [],
      tempCacheSize;

  if (this.charlotte) {
    shared = this.charlotte.shared;
    htmlBundleMode = this.charlotte.htmlBundleMode || false;
    cacheSeedLocation = this.charlotte.cacheSeedLocation || "./cache_seed";
    readyRegistryTimeToLive = this.charlotte.readyRegistryTimeToLive || 15000;
    baseUrl = this.charlotte.baseUrl;
    rootUrl = this.charlotte.rootUrl || "/" ;
    assetRootUrl = this.charlotte.assetRootUrl || rootUrl;
    tempCacheSize = this.charlotte.tempCacheSize;
  }
  
  charlotte = this.charlotte = {
    shared: shared,
    htmlBundleMode: htmlBundleMode,
    cacheSeedLocation: cacheSeedLocation,
    readyRegistry: readyRegistry,
    readyRegistryTimeToLive: readyRegistryTimeToLive,
    baseUrl: baseUrl,
    rootUrl: rootUrl,
    assetRootUrl: assetRootUrl,
    tempCacheSize: tempCacheSize
  };
      
  if (inNativeApp) {
    for (var k in FILE_ERROR_CONST_NAME_TO_STR_MSG_MAP) {
      FILE_ERROR_MESSAGES[FileError[k]] = FILE_ERROR_CONST_NAME_TO_STR_MSG_MAP[k];
    }    
  }

  var canCaptureStack = !!Error.captureStackTrace;
  
  _.each({
      ServerUnavailableError: function(url, message) {  
        this.name = "ServerUnavailableError";
        this.url = url;
        this.message = message || "Could not contact the server when accessing " + url;  
        if (canCaptureStack) Error.captureStackTrace(this, arguments.callee);
      },
      
      ResourceNotFoundError: function(url, message) {
        this.name = "ResourceNotFoundError";
        this.url = url;
        this.message = message || "Resource not found: " + url;
        if (canCaptureStack) Error.captureStackTrace(this, arguments.callee);
      },
      
      RedirectError: function(settings, location, message) {
        this.settings = settings;
        this.location = location;
        this.message = message || "Redirected to location: " + location;
        if (canCaptureStack) Error.captureStackTrace(this, arguments.callee);
      },
      
      AssetLoadError: function(src, message) {  
        this.name = "AssetLoadError";
        this.message = message || "Error loading asset " + src; 
        if (canCaptureStack) Error.captureStackTrace(this, arguments.callee);
      }
    }, function(ctor, name) {
      charlotte[name] = ctor;
      ctor.prototype = new Error();
      ctor.prototype.constructor = ctor;
      eval(name + ' = charlotte.' + name);      
    });
  
  function clone(obj) {
    var copy;
    if (!obj) {
      return obj;
    } else if (obj instanceof Date) {
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
    } else if (obj instanceof Array) {
      copy = [];
      for (var i = 0, len = obj.length; i < len; ++i) {
        copy[i] = clone(obj[i]);
      }
      return copy;
    } else if (obj.constructor === Object) {
      copy = {};
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
      }
      return copy;
    } else {
      return obj;
    }
  }

  function ajax(path, settings, compileData, callback) {
    settings = settings || {};
    settings.url = path;
    $.ajax(_.extend({
      success: function(data) {
        if (data) {
          callback(null, data, compileData ? compileData(data) : data);
        } else {
          callback(new ServerUnavailableError(path, "Could not retrieve resource: " + path));
        }
      }, 
      error: function(xhr, type) {
        var err;
        if ( type == "timeout" || xhr.status == 503 || !xhr.status) {
          err = new ServerUnavailableError(path);
        } else {
          if (xhr.status == 404) {
            err = new ResourceNotFoundError(path);
          } else{
            err = new Error("Error getting url " + path + ": " + 
                            xhr.status +  " " + xhr.responseText);
          }
          if (settings.headers && settings.headers.Accept.match(/html-bundle/) ) {
            err.data = xhr.responseText;
            try {
              err.bundle = compileData(xhr.responseText);
            } catch (e) {}
          }
        }
        callback(err);
      }
    }, settings));
  }
      
  function upload(url, settings, compileData, callback) {
    var uploadOptions = settings.uploadOptions;
    uploadOptions.params = uploadOptions.params || {};
    uploadOptions.params.Accept = shared.HTML_BUNDLE_MIME_TYPE;      
    new FileTransfer().upload(uploadOptions.fileUri || uploadOptions.fileURI, url,
      function(res) {
        var data = res.response;
        console.log("data: " + data);
        callback(null, data, compileData ? compileData(data) : data);        
      }, 
      function(err) {
        console.log("err: " + err.toString());
        next(new Error("Error uploading file: " + charlotte.FILE_ERROR_MESSAGES[err.code]));
      }, 
      uploadOptions);
    
  }
  
  function getTempCacheResource(url) {
    return tempCache[url];
  }
  
  function setTempCacheResource(url, data) {
    var tempCacheSize = charlotte.tempCacheSize,
        item = tempCache[url],
        newSize;
    
    if (tempCacheSize && data.length > tempCacheSize) {
      return callback(new Error(url + " (size: " + data.length + 
                                ") exceeds temp cache size (" + tempCacheSize + ")."));
    }
    
    if (item) {
      newSize = tempCache.size - item.length + data.length; 
    } else {
      newSize = tempCache.size + data.length;
      tempCacheQueue.push(data);
    }
    tempCache[url] = data;
    
    if (tempCacheSize && newSize > tempCacheSize) {
      // reduce to 75% of limit
      var targetSize = tempCacheSize * 0.75;
      for (var i = 0; newSize > targetSize; i++) {
        newSize -= tempCacheQueue[i].length;
      }
      tempCacheQueue = tempCacheQueue.slice(i);        
    }
    tempCache.size = newSize;
  }

  function getDirectory(path, options, callback) {
    options = options || {create:true};
    var nodes = path.split('/'),
        currNodeIndex = 0,
        currDir;

    if (nodes[0] === '') nodes.shift();

    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, 
      function(fs) {
        currDir = fs.root;
        async.whilst(
          function() {
            return currNodeIndex < nodes.length;
          },
          function (callback) {
            currDir.getDirectory(nodes[currNodeIndex], options, 
              function(dir) {
                currDir = dir;
                callback();
              },
              function(err) {
                callback(new Error("Error getting directory " + path + ": " + FILE_ERROR_MESSAGES[err.code]));
              });
            currNodeIndex++;
          }, 
          function(err) {
            callback(err, currDir);
          });
      },
      function(err) {
        callback(new Error("Error requesting filesystem. " + FILE_ERROR_MESSAGES[err.code]));
      });
  
  }

  function getFile(path, options, callback) {
    var m, dirPath, fileName;
    m = path.match(/^(.*)\/([^\/]+)$/);
    dirPath = m[1];
    fileName = m[2];
    getDirectory(dirPath, options, function(err, dir) {
      if (err) return callback(err);
      dir.getFile(fileName, options, 
        function(file) { 
          if (!fileFullPathRoot) {
            fileFullPathRoot = file.fullPath.slice(0, file.fullPath.indexOf(path));
          }
          callback(null, file);
        }, 
        function(err) {
          callback(new Error("Error getting file " + path + ": " + FILE_ERROR_MESSAGES[err.code]));
        });
    });
  }

  function writeToFile(path, data, callback) {
    async.waterfall([
    
      function(next) {
        getFile(path, {create:true}, next);
      },

      function(file, next) {
        file.createWriter(
          function(writer) {
            next(null, file.fullPath, writer); 
          }, next);
      },

      function(fullPath, writer, next) {
        writer.onwrite = function(evt) {
          console.log("Wrote file: " + path);
          next(null, fullPath);
        };
        writer.onerror = function(e) {
          next(new Error("Error writing file " + path + ": " + FILE_ERROR_MESSAGES[e.code]));
        };
        writer.write(data);
      }
    ], callback);
  
  }
  
  function getFilePath(rootUrl, version, url, calcRelativePath) {
    var parsedRootUrl = shared.parseUrl(rootUrl),
        rootPath = RES_CACHE_ROOT + '/' +
                   (parsedRootUrl.host + 
                    parsedRootUrl.pathname).replace(/[:\/]/g, '_'),
        versionRootPath,
        parsedUrl,
        host,
        path,
        relativePath;

    if (!version) return rootPath;

    versionRootPath = rootPath + '/' + version;
    
    if (!url) return versionRootPath;
    
    parsedUrl = shared.parseUrl(url);
    host = parsedUrl.host;
    path = parsedUrl.pathname;
    relativePath = calcRelativePath(path, parsedUrl.search);
    return versionRootPath + '/' + host.replace(':', '_') + '/' + relativePath;
  }

  function getFileUrl(rootUrl, version, url, calcRelativePath) {
    var filePath = getFilePath(rootUrl, version, url, calcRelativePath);
    return "file://" + fileFullPathRoot + filePath;
  }
  
  function getFileUrlCacheItem(rootUrl, version, url) {
    if (fileUrlCache[rootUrl] && fileUrlCache[rootUrl][version]) {
      return fileUrlCache[rootUrl][version][url];
    } else {
      return null;
    }
  }
  
  function updateFileUrlCacheItem(rootUrl, version, url, fullPath) {
    fileUrlCache[rootUrl] = fileUrlCache[rootUrl] || {};
    fileUrlCache[rootUrl][version] = fileUrlCache[rootUrl][version] || {};
    fileUrlCache[rootUrl][version][url] = 'file://' + fullPath;
  }
   
  function getResourceCacheItem(rootUrl, version, url) {
    if (resourceCache[rootUrl] && 
        resourceCache[rootUrl][version] && 
        resourceCache[rootUrl][version][url]) {
      console.log("Got resource from RAM cache: " + url);
      return resourceCache[rootUrl][version][url];
    } else {
      return null;
    }
  }
  
  function setResourceCacheItem(rootUrl, version, url, data) {
    resourceCache[rootUrl] = resourceCache[rootUrl] || {};
    resourceCache[rootUrl][version] = resourceCache[rootUrl][version] || {};
    resourceCache[rootUrl][version][url] = data;
  }
  
  function getResourceCacheFile(rootUrl, version, url, filePath, compileData, timeout, onCacheMiss, getServerResource, callback) {

    // NOTE: we're assuming you don't need need the original source data 
    // when you pass a compileData function, so we send back null for that
    // callback argument when we don't have it

    var fileUrl,
        resourceCacheItem;
            
    fileUrl = getFileUrlCacheItem(rootUrl, version, url);
    
    if (fileUrl) {
      if (!compileData) {
        return callback(null, fileUrl);
      } else {
        resourceCacheItem = getResourceCacheItem(rootUrl, version, url);
        if (resourceCacheItem) {
          // see note above about why we send null back for file data
          return callback(null, fileUrl, null, resourceCacheItem);          
        }
      }
    }

    console.log("Getting resource cache file: " + filePath);
    
    async.waterfall([
      function(next) {
        getFile(filePath, {create: false}, function(err, file) {
          if (!err) { // break out of waterfall and return fileUrl/data
            updateFileUrlCacheItem(rootUrl, version, url, file.fullPath);
            fileUrl = getFileUrlCacheItem(rootUrl, version, url);
            console.log("Found in cache: " + filePath);
            if (compileData) {
              var resourceCacheItem = getResourceCacheItem(rootUrl, version, url);
              if (resourceCacheItem) {
                console.log("Got resource from RAM cache: " + url);
                // see note above about why we send null back for file data
                return callback(null, fileUrl, null, resourceCacheItem);
              }
              ajax(fileUrl, {timeout:timeout}, compileData, function(err, data, compiled) {
                setResourceCacheItem(rootUrl, version, url, compiled);
                callback(err, fileUrl, data, compiled);
              });
            } else {
              callback(null, fileUrl);        
            }          
          } else { // continue waterfall
            if (onCacheMiss) onCacheMiss(url);
            next();
          }
        
        });
      },
        
      function(next) {
        var url = cacheSeedLocation + filePath;
        ajax(url, null, compileData, function(err, data, compiled) {
          if (err) {
            getServerResource(function(err, fullPath, fileData, compiled, newVersion) {
              var data = fileData;
              if (newVersion) {
                version = newVersion;
              }
              updateFileUrlCacheItem(rootUrl, version, url, fullPath);
              if (compileData) {
                setResourceCacheItem(rootUrl, version, url, compiled);
              }
              next(err, getFileUrlCacheItem(rootUrl, version, url), data, compiled);
            });          
          } else {
            console.log("Retrieved resource from cache seed: " + url);
            writeToFile(filePath, data, function(err, fullPath) {
              if (err) return next(err);
              if (compileData) {
                setResourceCacheItem(rootUrl, version, url, compiled);
              }
              updateFileUrlCacheItem(rootUrl, version, url, fullPath);
              next(err, getFileUrlCacheItem(rootUrl, version, url), data, compiled);
            });
          }
        });
      }
    
    ], callback);

  }

  function encodeQueryString(s) {
    return s.replace('?', '__qm__').
             replace('&', '__amp__').
             replace('=', '__eq__').
             replace('%', '__pct__');
  }

  function transformStylesheetUrls(text, transform) {
    return text.replace(/url\s*\(([^\)]+)\)+/g, function(str, p1, offset, s) {
      var quoteMatch = p1.match(/^\s*(['"])([^'"]+)['"]/),
          quoteChar,
          url,
          fileUrl,
          resolvedUrl;
      if (quoteMatch) {
        quoteChar = quoteMatch[1];
        url = quoteMatch[2];
      } else {
        quoteChar = "'";
        url = p1;
      }
      return 'url(' + quoteChar + transform(url) + quoteChar + ')';
    });
  }
  
  function getAssetCacheFile(rootUrl, assetRootUrl, version, url, compileData, timeout, onCacheMiss, callback) {
    var filePath = getFilePath(rootUrl, version, url, calcRelFilePath);

    function calcRelFilePath(path, query) {
      return path + encodeQueryString(query);
    }
                   
    getResourceCacheFile(rootUrl, version, url, filePath, compileData, timeout, onCacheMiss,
      function(callback) {
        var isCss = url.match(/\.css$/);
        console.log("Getting remote asset: " + url);
        if (compileData || isCss) {
          async.waterfall([

            async.apply(ajax, url, {timeout:timeout}, compileData),
            
            function(data, compiled, next) {
              var resourcesToGet = [];
              if (isCss) {
                data = transformStylesheetUrls(data, function(url) {
                  var resolvedUrl = shared.resolveUrl(assetRootUrl, 
                                                      shared.versionAssetUrl(version, url));
                  resourcesToGet.push(resolvedUrl);
                  return getFileUrl(rootUrl, version, resolvedUrl, calcRelFilePath);
                });
              }
              
              console.log("Getting css referenced resources: " + resourcesToGet.join(','));
              // get all referenced resources before writing out css file itself
              async.forEach(resourcesToGet, 
                function(url, callback) {
                  // recurse
                   getAssetCacheFile(rootUrl, assetRootUrl, version, url, null, timeout,
                                     onCacheMiss, callback);
                },
                function(err) {
                  next(err, data, compiled);
                });
            },

            function(data, compiled, next) {
              // console.log("about to write file: " + filePath)
              // console.log("data: " + data)
              writeToFile(filePath, data, function(err, fullPath) {
                if (err) return next(err);
                next(err, fullPath, data, compiled);
              });              
            }
          ], callback);
        } else {
          getFile(filePath, {create: true}, function(err, file) {
            if (err) return callback(err);
            var fileTransfer = new FileTransfer();
            fileTransfer.download(url, file.fullPath,
              function() {
                console.log("Downloaded file: " + filePath);
                callback(null, file.fullPath);
              },
              function(err) {
                callback(new Error("Error downloading file: " + FILE_ERROR_MESSAGES[err.code]));
              });
            });
        }
      }, 
      callback);
  }
  
  function getVersion(rootUrl, timeout, callback) {
    var versionKey = shared.removeUrlMultislashes(rootUrl + "/version");
    ajax(shared.resolveUrl(rootUrl, "/version"), {timeout:timeout}, null, 
      function(err, version) {
        if (err && !(err instanceof ServerUnavailableError)) return callback(err);
        if (version) {
          localStorage.setItem(versionKey, version);
        }
        callback(null, version);
      });
  }
  
  function assets(options, versionCallback, findExisting, onCacheMiss, addNew, callback) {
    var version = options.version || this.version,
        rootUrl = options.rootUrl || this.rootUrl,
        assetRootUrl = options.assetRootUrl || this.assetRootUrl || rootUrl,
        extname = options.extname || '',
        urls = _.map(options.urls, function(url) { return url + extname; }),
        timeout = options.timeout || 5000,
        version;
            
    async.waterfall([
      function(next) {
        if (version) next();
        else {
          getVersion(rootUrl, timeout, function(err, ver) {
            version = ver;
            next(err);
          });
        }
      },
      
      function(next) {
        versionCallback(version);
        if (version) {
          _.each(urls, function(url, i) {
            urls[i] = shared.versionAssetUrl(version, url);
          });
        }
        async.map(urls, function(url, callback) {
          url = shared.resolveUrl(assetRootUrl, url);
          if (version && inNativeApp) {
            getAssetCacheFile(rootUrl, assetRootUrl, version, url, null, timeout, onCacheMiss, callback);
          } else {
            callback(null, url);
          }
        }, next);
      },
      
      function(mappedUrls, next) {
        async.series(
          _.map(mappedUrls, function(mappedUrl) {
            return function(callback) {
              var existingEl = findExisting(mappedUrl);
              if (existingEl && existingEl.length > 0 && version) {
                return callback();
              }
              addNew(mappedUrl, function(err, newEl) {
                if (err) return callback(err);
                _.each(findExisting(mappedUrl), function(el) {
                  if (newEl === el || !el.__loaded) return;
                  el.parentNode.removeChild(el);
                });
                callback();
              });
            };
          }), function(err) { next(err); });
      }
    ], callback);
  }
    
  function resolveModuleValue(name) {
    var module = modules[name];
    if (!module.value) {
      var dependencyValues = _.map(module.dependencies, function(name) {
        return resolveModuleValue(name);
      });
      module.value = module.callback.apply(this, dependencyValues);
    }
    return module.value;
  }
      
  function ready(requestId, callback) {
    readyRegistry[requestId] = readyRegistry[requestId] || [];
    readyRegistry[requestId].push(callback);
    readyRegistryTimestamps[requestId] = Date.now();
  }
  
  function cleanReadyRegistry() {
    var now = Date.now();
    _.each(readyRegistryTimestamps, function(time, requestId) {
      if (now - time > charlotte.readyRegistryTimeToLive) {
        // console.log("deleting " + requestId + " from readyRegistry.");
        delete readyRegistry[requestId];
        delete readyRegistryTimestamps[requestId];
      };
    })
    setTimeout(cleanReadyRegistry, charlotte.readyRegistryTimeToLive);
  }
  
  cleanReadyRegistry();
  
  function createTriggerReadyFunc(requestId, version, context) {
    var readyCallbackChain = readyRegistry[requestId];

    delete readyRegistry[requestId];
    
    return function(callback) {
      async.waterfall(
        _.map(readyCallbackChain, function(f) {
          return function(next) {
            if (_.isFunction(f)) {
              var versionedAssetMethodWrappers = {};
              _.each(ASSET_METHOD_NAMES, function(name) {
                  versionedAssetMethodWrappers[name] = function(options, callback) {
                    context[name].call(context, _.extend({}, options, {version: version}), callback);
                  };
                });
              f.call(_.extend({}, context, versionedAssetMethodWrappers), next);
            } else if (_.isString(f)) {
              context.require({
                  version: version,
                  dependencies: [f]
                }, function(err, module) {
                  if (err) return next(err);
                  module.call(this, next);
                });
            } else {
              next(new Error("Ready callback must be a module name or a function."));
            }
          };
        }), 
        function(err) {
          if (callback) callback(err);
        });
    };
  }
    
  function disableElement(el) {
    $(el).on('click tap', 'a', function(e) {
      e.preventDefault();
      return false;
    });
    $('input,textarea,button', el).attr('disabled', true);
  }
  
  function enableElement(el) {
    $('input,textarea,button', el).removeAttr('disabled');
  }
  
  charlotte.inNativeApp = inNativeApp;
  
  charlotte.FILE_ERROR_MESSAGES = FILE_ERROR_MESSAGES;

  charlotte.HTML_BUNDLE_MIME_TYPE = shared.HTML_BUNDLE_MIME_TYPE;
      
  charlotte.clearRamCache = function(options) {
    var rootUrl = options.rootUrl || this.rootUrl,
        versionExceptions = options.versionExceptions || [];
    tempCache = {};
    tempCacheQueue = [];
    _.each([resourceCache[rootUrl], fileUrlCache[rootUrl]], function (cache) {
      _.each(cache, function(versionCache, version) {
        if (!_.include(versionExceptions, version)) {
          console.log("Deleting version " + version + " from a RAM cache.");
          delete cache[version];
        }
      });
    });
    console.log("Cleared RAM cache." + 
                (versionExceptions.length > 0 ? 
                  "(excluding versions " + versionExceptions.join(', ') + ")" :
                  "") );
  };
  
  charlotte.clearFileCache = function(options, callback) {
    var rootUrl = options.rootUrl || this.rootUrl,
        versionExceptions = options.versionExceptions || [];
    async.waterfall([
      function(next) {
        getDirectory(getFilePath(rootUrl), null, next);
      },
      
      function(dir, next) {
        dir.createReader().readEntries(
          function(entries) {
            next(null, entries);
          },
          function(err) {
            next(new Error("Error reading directories entries: " + FILE_ERROR_MESSAGES[err.code]));
          });
      },
      
      function(entries, next) {
        async.forEach(entries, function(entry, callback) {
          function success(entry) {
            callback();
          }
          function fail(err) {
            callback(new Error("Error removing directory entry: " + FILE_ERROR_MESSAGES[err.code]));
          }
          
          if (_.include(versionExceptions, entry.name) || entry.name[0] == '.') {
            callback();
          } else if (entry.isFile) {
            entry.remove(success, fail);
          } else if (entry.isDirectory) {
            entry.removeRecursively(success, fail);
          } else {
            callback(new Error("directory entry is somehow neither a file or a directory"));
          }
        }, next);
      }
    ], callback);
  };
  
  charlotte.javascripts = function(options, callback) {
    var isAsync = options.async || false,
        onCacheMissOnce = options.onCacheMiss ? _.once(options.onCacheMiss) : null,
        javascripts = document.getElementsByTagName('script'),
        head = document.getElementsByTagName('head')[0],
        internal;
    options.extname = '.js';
    assets.call(this, options,
      function(version) {
         internal = !version && !navigator.userAgent.match(/Chrome/);
      },
      function(url) {
        var existing = [],
            srcAttribute = internal ? '__src' : 'src';
        for (var i = 0; i < javascripts.length; i++) {
          script = javascripts[i];
          if (script.getAttribute(srcAttribute) == url) {
            existing.push(script);
          }
        }
        return existing;
      },
      onCacheMissOnce,
      function(scriptUrl, callback) {
        var script = document.createElement('script');
        script.async = isAsync;
        script.type = 'text/javascript';
        script.onerror = function(e) {
          callback(new AssetLoadError(scriptUrl));
        };
        if (internal) {  
          ajax(scriptUrl, null, null, function(err, data) {
            if (err) return callback(err);
            script.setAttribute('__src', scriptUrl);
            script.text = data;
            head.appendChild(script);
            script.__loaded = true;
            callback(null, script);
          });
        } else {
          script.onload = function(e) { 
            script.__loaded = true; 
            callback(null, script); 
          };
          script.src = scriptUrl;
          head.appendChild(script);
        }
      },
      callback);
  };

  charlotte.stylesheets = function(options, callback) {
    var assetRootUrl = options.assetRootUrl || this.assetRootUrl || 
                    options.rootUrl || options.rootUrl,
        timeout = options.timeout || 5000,
        onCacheMissOnce = options.onCacheMiss ? _.once(options.onCacheMiss) : null,
        links = document.getElementsByTagName('link'),
        styles = document.getElementsByTagName('style'),
        head = document.getElementsByTagName('head')[0],
        start = Date.now(),
        idCounter = start,
        internal;
    options.extname = '.css';
    assets.call(this, options,
      function(version) {
         internal = !version && !navigator.userAgent.match(/Chrome/);
      },
      function(url) {
        var existing = [],
            hrefAttr = internal ? '__href' : 'href',
            elements = internal ? styles : links,
            el;
        for (var i = 0; i < elements.length; i++) {
          el = elements[i];
          if (el.getAttribute(hrefAttr) === url) {
            existing.push(el);
          }
        }
        return existing;
      },
      onCacheMissOnce,
      function(linkUrl, callback) {
        if (internal) {
          var style = document.createElement('style');
          ajax(linkUrl, null, null, function(err, data) {
            if (err) return callback(err);
            style.setAttribute('__href', linkUrl);
            if (inNativeApp) {
              data = transformStylesheetUrls(data, function(url) {
                return shared.resolveUrl(assetRootUrl, url);
              });              
            }
            style.innerText = data;
            head.appendChild(style);
            style.__loaded = true;
            callback(null, style);
          });          
        } else {
          var link = document.createElement('link'),
              timedOut = false;
          link.id = "__stylesheet" + idCounter;
          idCounter++;
          link.rel = "stylesheet"; 
          link.type = "text/css";
          link.href = linkUrl;
          head.appendChild(link); 
          async.until(
            function() {
              var stylesheets = document.styleSheets;
              if (Date.now() - start > timeout) {
                timedOut = true;
                return true;
              }
              for(var i = 0; i < stylesheets.length; i++) {
                var sheet = stylesheets[i];
                var owner = sheet.ownerNode ? sheet.ownerNode : sheet.owningElement;
                if (owner && owner.id == link.id) {
                  link.__loaded = true;
                  return true;
                } 
              }
              return false;
            },
            function(callback) {
              setTimeout(callback, 100);
            },
            function() {
              callback(timedOut ? new AssetLoadError(linkUrl) : null, link);
            });          
        }
      },
      callback);  
  };

  charlotte.assets = function(options, callback) {
    var self = this,
        stylesheetOptions = options.stylesheets ? clone(options.stylesheets) : null,
        scriptOptions = options.javascripts ? clone(options.javascripts) : null,
        onCacheMissOnce = options.onCacheMiss ? _.once(options.onCacheMiss) : null;
        funcs = [];
        
    function setOptions(opts) {
      ['rootUrl', 'assetRootUrl', 'version'].forEach(function(attr) {
        opts[attr] = options[attr];
      });
      opts.onCacheMiss = onCacheMissOnce;
    }
    
    if (stylesheetOptions) {
      setOptions(stylesheetOptions);
      funcs.push(function(next) {
        self.stylesheets.call(self, stylesheetOptions, next);
      });
    }
    if(scriptOptions) {
      setOptions(scriptOptions);
      funcs.push(function(next) {
        self.javascripts.call(self, scriptOptions, next);
      });
    }
    async.waterfall(funcs, function(err){
      callback(err);
    });
  };
  
  charlotte.define = function(name, depsOrCallback, callback) {
    var deps,
        parsedUrl = shared.parseUrl(name),
        baseUrl = parsedUrl.protocol + "//" + parsedUrl.host + "/";
    if (arguments.length > 2) {
      deps = depsOrCallback;
    } else {
      deps = [];
      callback = depsOrCallback;
    }
    modules[name] = {
      dependencies: _.map(deps, function(url) { return shared.resolveUrl(baseUrl, url); }),
      callback: callback,
      value: null
    };
  };
  
  charlotte.require = function(options, callback) {
    
    var self = this,
        baseUrl = options.baseUrl || this.baseUrl,
        rootUrl = options.rootUrl || this.rootUrl,
        assetRootUrl = options.assetRootUrl || this.assetRootUrl || rootUrl,
        version = options.version || this.version,
        parsedBaseUrl = shared.parseUrl(baseUrl),
        unloadedDependencies = _.map(options.dependencies, function(url) {
          return {
            name: shared.resolveUrl(baseUrl, url),
            url: url
          };
        }),
        resolvedDependencyNames = _.map(unloadedDependencies, function(dep) {
          return dep.name;
        }), 
        encounteredDependencies = {};
        
    async.whilst(
      function() {
        return unloadedDependencies.length > 0;
      },
      function(callback) {
        _.each(unloadedDependencies, function(dep) {
          encounteredDependencies[dep.name] = true;
        }); 
        var javascriptsOptions = {
          rootUrl: rootUrl,
          assetRootUrl: assetRootUrl,
          version: version,
          urls: _.map(unloadedDependencies, function(dep) { return dep.url;})
        };
        self.javascripts(javascriptsOptions, function(err) {
          if (err) return callback(err);
          var newDependencies = [];
          _.each(unloadedDependencies, function(dep) {
            if (!modules[dep.name]) {
              return callback(new Error("module " + dep.name + " did not define itself successfully."));
            }
            _.each(modules[dep.name].dependencies || [], function(name) {
              if (!encounteredDependencies[name]) {
                var parsedName = shared.parseUrl(name),
                    url;
                if (parsedName.host == parsedBaseUrl.host) {
                  url = parsedName.pathname;
                } else {
                  url = name;
                }
                newDependencies.push({
                  name: name,
                  url: url
                });
              }
            });
          });
          unloadedDependencies = newDependencies;
          callback();
        });
      },
      function(err) {
        if (err) return callback(err);
        var callbackArgs = _.map(resolvedDependencyNames, function(name) { 
                            return resolveModuleValue(name); 
                          });
        callbackArgs.unshift(null);
        callback.apply(self, callbackArgs);
      });
  };
  
  function resolveRootUrl(url) {
    if (url.match(/^http/)) return url;
    else {
      var loc = document.location;
      return loc.protocol + '//' + loc.host + url;
    }
    
  }
  
  charlotte.ready = function(requestId, func) {
    var self = this;
    ready(requestId, func);
    if (! self.htmlBundleMode && ! self.readyRegistered) {
      $(document).ready(function() {
        createTriggerReadyFunc(requestId, null, self)();
      });
      self.readyRegistered = true;
    }
  };
  
  charlotte.createBrowser = function(options){
    options = options || {};  
    var browser,
        timeout = options.timeout || 5000,
        baseUrl = options.baseUrl,
        rootUrl = resolveRootUrl(options.rootUrl || charlotte.rootUrl),
        assetRootUrl = resolveRootUrl(options.assetRootUrl || charlotte.assetRootUrl || rootUrl),
        defaultFollowRedirects = _.isUndefined(options.followRedirects) ? 
                                  true : options.followRedirects,
        defaultLayoutBodyOverride = options.layoutBody,
        helpers = _.extend({
            rootUrl: rootUrl,
            assetRootUrl: assetRootUrl,
            inNativeApp: inNativeApp,
            isBlank: shared.isBlank
          }, options.helpers || {}),
        dynamicHelpers = options.dynamicHelpers,
        templateCompilers = options.templateCompilers || {
          '.jade': function(text) {
            return jade.compile(text);
          }
        },
        defaultTemplateExtname = options.defaultTemplateExtname || ".jade",
        cachedBundleOptions = options.cachedBundles || {},
        errorHandlers = options.errorHandlers || {},
        defaultOnVersionChange = options.onVersionChange,
        defaultOnCacheMiss = options.onCacheMiss,
        defaultOnRequestEnd = options.onRequestEnd,
      
        tabs = {},
        currentTab,
        onTabSwitch = options.onTabSwitch;

    cachedBundleOptions.viewOnlyUrlMatchers = cachedBundleOptions.viewOnlyUrlMatchers || {};
    cachedBundleOptions.urlMatchers = cachedBundleOptions.urlMatchers || [];
    cachedBundleOptions.tempUrlMatchers = cachedBundleOptions.tempUrlMatchers || [];
    
    function browserAjax(url, options, compileData, callback) {
      options = options || {};
      ajax(url, 
           _.extend(options, {
             timeout: options.timeout || timeout
           }),
           compileData,
           callback);
    }
        
    function parseBundle(data) {
      return JSON.parse(data, function (key, value) {
        if (typeof value != 'string') return value;
        var isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}.\d{3})Z$/);
        if (isoMatch) {
          var date = new Date();
          date.setUTCFullYear(isoMatch[1]);
          date.setUTCMonth(isoMatch[2]-1);
          date.setUTCDate(isoMatch[3]);
          date.setUTCHours(isoMatch[4]);
          date.setUTCMinutes(isoMatch[5]);
          date.setUTCSeconds(isoMatch[6]);
          return date;
        } else return value;
      });
    }
  
    function _getBundleCacheFile(rootUrl, version, url, headers, calcRelativeFilePath, onCacheMiss, callback)  {
      var filePath = getFilePath(rootUrl, version, url, calcRelativeFilePath);
      getResourceCacheFile(rootUrl, version, url, filePath, parseBundle, timeout, onCacheMiss,
        function(callback) {
          console.log("getting remote bundle " + url);
          ajax(url, {
                 timeout: timeout,
                 headers: headers
               }, 
               parseBundle,
               function(err, data, bundle) {
                 var newVersion;
                 if (err) return callback(err);
                 if (bundle.version && version != bundle.version) {
                   newVersion = bundle.version;
                   filePath = getFilePath(rootUrl, newVersion, url, calcRelativeFilePath);
                 }
                 writeToFile(filePath, data, function(err, fullPath) {
                   callback(err, fullPath, data, bundle, newVersion);
                 });
               });
        },
        function(err, fileUrl, fileData, bundle) {
          if (err) return callback(err);
          callback(err, fileData, bundle);
        });
    }
  
    function getBundleCacheFile(rootUrl, version, url, headers, onCacheMiss, callback)  {
      _getBundleCacheFile(rootUrl, version, url, headers,
                          function(path, query) {
                            var relPath =  shared.removeUrlMultislashes(path + "/index" + encodeQueryString(query) + '.json');
                            return relPath;
                          },
                          onCacheMiss, 
                          callback);
    }
    
    function getViewOnlyBundleCacheFile(rootUrl, version, url, headers, key, onCacheMiss, callback)  {
      _getBundleCacheFile(rootUrl, version, url, headers,
                          function(path, query) {
                            return 'view_only_bundles/' + key + encodeQueryString(query) + '.json';
                          }, 
                          onCacheMiss,
                          callback);
    }
  
    function resolveExtname(url) {
      var match = url.match(/\.\w+$/);
      if (match) {
        return [match[1], url];
      } else {
        return [defaultTemplateExtname, url + defaultTemplateExtname];
      }
    }
    
    function renderTemplate(version, layoutPath, templatePath, req, options, onCacheMiss, renderTemplateCallback) {
      var templates = {}, 
          templatesLeftToRetrieve,
          dynamicHelperValues = {}, 
          renderedTemplate,
          stylesheetUrls = [], 
          javascriptUrls = [],
          inlineAssetsToRetrieve = [],
          shouldTryCache = version && inNativeApp;

      function addToUrlList(urlHolder, helperArgs) {
        var lastArg = helperArgs[helperArgs.length-1],
            end = helperArgs.length;
        if (_.isObject(lastArg)) {
          end -= 1;
        }
        for (var i = 0; i < end; i++) {
          urlHolder.push(helperArgs[i]);
        }                    
      }

      _.each(dynamicHelpers, function(f, k) { dynamicHelperValues[k] = f(req); });
        
      templatesLeftToRetrieve = [templatePath];
      if (layoutPath) templatesLeftToRetrieve.push(layoutPath);
          
      var passes = 0;
      async.whilst(
        
        function() { 
          // console.log("template " + templatePath + " templates left to retrieve: " + templatesLeftToRetrieve.join(', '))
          return templatesLeftToRetrieve.length > 0; 
        },
        
        function(callback) {
          // console.log("template " + templatePath +  " pass " + (++passes));
          async.forEach(templatesLeftToRetrieve, 
            function(path, callback) {
              var extnameRes = resolveExtname(path),
                  extname = extnameRes[0], url = extnameRes[1],
                  compile = templateCompilers[extname];
              if (version) {
                url = shared.versionAssetUrl(version, url); 
              }
              url = shared.resolveUrl(assetRootUrl, url);
              if (shouldTryCache) {
                getAssetCacheFile(rootUrl, assetRootUrl, version, url, compile, timeout, onCacheMiss,
                                  function(err, fileUrl, data, compiled) {
                                    templates[path] = compiled;
                                    callback(err);
                                  });
              } else {
                browserAjax(url, null, compile, 
                  function(err, data, compiled) {
                    templates[path] = compiled;
                    callback(err);
                  });
              }
            }, 
            function(err) {
              var templateTemplate = templates[templatePath],
                  layoutTemplate = templates[layoutPath];
                
              if (err) return callback(err);
            
              templatesLeftToRetrieve = [];
              var mergedOptions = _.extend({}, helpers, dynamicHelperValues, options, {
                stylesheets: function() {
                  addToUrlList.call(this, stylesheetUrls, arguments);
                },
                javascripts: function() {
                  addToUrlList.call(this, javascriptUrls, arguments);
                },
                img: function(options) {
                  var url = options.src,
                      resolvedUrl = shared.resolveUrl(assetRootUrl, shared.versionAssetUrl(version, url)),
                      tagUrl;
                  if (shouldTryCache) {
                    inlineAssetsToRetrieve.push(resolvedUrl);
                    tagUrl = getFileUrl(rootUrl, version, resolvedUrl, 
                                        function(path, query) {
                                          return path + encodeQueryString(query);
                                        });
                  } else {
                    tagUrl = resolvedUrl;
                  }
                  return shared.tag('img', 'src', function() { return tagUrl; }, arguments[0]);                  
                }
              });
              mergedOptions.partial = function(path, partialOptions) {
                var url = shared.resolveUrl(assetRootUrl, resolveExtname(path)[1]),                
                    template = templates[path] || getResourceCacheItem(rootUrl, version, url);
                if (template) {
                  return template(_.extend(this, partialOptions));                                  
                } else {
                  templatesLeftToRetrieve.push(path);                  
                }
              };
              try {
                renderedTemplate = templateTemplate(mergedOptions);
                if (layoutTemplate) {
                  mergedOptions.body = renderedTemplate;
                  renderedTemplate = layoutTemplate(mergedOptions);
                }
              } catch (e) {
                callback(e);
              }
              callback();         
            });
        }, 
        
        function(err) {
          // console.log("template " + templatePath +  " finished passes, count: " + passes);
          if (err) return renderTemplateCallback(err);
          async.parallel([
            function(callback) {
              charlotte.assets({
                rootUrl: rootUrl,
                assetRootUrl: assetRootUrl,
                version: version,
                stylesheets: {
                  urls: stylesheetUrls
                },
                javascripts: {
                  urls: javascriptUrls
                },
                onCacheMiss: onCacheMiss
              }, callback);              
            },
            
            function(callback) {
              async.forEach(inlineAssetsToRetrieve, function(url, callback) {
                getAssetCacheFile(rootUrl, assetRootUrl, version, url, 
                  null, timeout, onCacheMiss, callback);
              }, callback);
            }
          ], function(err) {
            if (err) renderTemplateCallback(err);
            else renderTemplateCallback(null, renderedTemplate);            
          });        
        });
    }
    
    function wrapCallbackWithErrorHandlers(tab, callback, internalCall) {
      return function() {
        var errorHandlerChain,
            args = arguments,
            err = arguments[0];
        if (err) {
          errorHandlerChain = [];
          if (errorHandlers.global) {
            errorHandlerChain.push(function(next) {
              errorHandlers.global(err);
              next();
            });
          }
          if (errorHandlers['default'] && !internalCall) {
            errorHandlerChain.push(function(next) {
              errorHandlers['default'](err, tab, next);
            });              
          }
          
          async.series(errorHandlerChain, function() {
            callback.apply(this, args);
          });
        } else {
          callback.apply(this, args);
        }  
      };     
    }
    
    function request(settings, callback, renderWait, tab, internalCall) {
      settings = clone(settings);
      renderWait = renderWait || function(callback) { callback(); };
      var viewOnly = settings.viewOnly || false,
          container = $(settings.container)[0],
          url = shared.resolveUrl(rootUrl, settings.url),
          fullUrl = url,
          followRedirects = _.isUndefined(settings.followRedirects) ? 
                              defaultFollowRedirects : settings.followRedirects,
          layoutBodyOverride = settings.layoutBody || defaultLayoutBodyOverride,
          onRequestEnd = settings.onRequestEnd || defaultOnRequestEnd || function() {},
          onCacheMiss = settings.onCacheMiss || defaultOnCacheMiss,
          onCacheMissOnce = _.once(function() {
             if (onCacheMiss) {
              onCacheMiss(fullUrl, tab); 
            }
          }),
          localVersion = localStorage.getItem("version"),
          requestId = url + '_' + Date.now() + Math.random(),
          callbackWrapper,
          onVersionChange = settings.onVersionChange || defaultOnVersionChange,
          isTempCacheUrl,
          tempCacheResource,
          tabContainer = tab ? tab.container : undefined;

      if (settings.uploadOptions) settings.type = "post";
      settings.type = settings.type || "get";
          
      function processBundle(data, bundle, callback) {

        async.waterfall([
          
          function(next) {
            if (bundle.version && localVersion && localVersion != bundle.version) {
              console.log("New remote version ..");
              if (onVersionChange) {
                console.log("Calling onVersionChange ..");
                return onVersionChange(localVersion, bundle.version,
                  function(err) {
                    if (!err) {
                      localStorage.setItem("version", bundle.version);
                      charlotte.clearRamCache({
                        rootUrl: browser.rootUrl, 
                        versionExceptions: [localVersion, bundle.version]
                      });
                    }
                    next(err, bundle);
                  });
              }
              localStorage.setItem("version", bundle.version);
              charlotte.clearRamCache({
                rootUrl: browser.rootUrl, 
                versionExceptions: [localVersion, bundle.version]
              });
            }
            next(null, bundle);
          },

          function (bundle, next) {
            var layoutPath,
                req = {
                  referer: settings.headers['X-Referer'],

                  flash: function(type) {
                    var msgs = bundle.flash || {};
                    if (type) {
                      var arr = msgs[type];
                      return arr || [];
                    } else {
                       return msgs;
                    }
                  }
                };

            if (bundle.locals.layoutBody !== false) {
              layoutPath = layoutBodyOverride || bundle.locals.layoutBody || "layout_body"; 
            }

            renderWait(function(err) {
              if (err) return next(err);
              renderTemplate(bundle.version, layoutPath, bundle.template, req,
                _.extend(bundle.locals, {
                  NODE_ENV: bundle.NODE_ENV,
                  version: bundle.version || '',
                  requestId: requestId,
                  viewOnly: viewOnly
                }),
                onCacheMissOnce, 
                function(err, html) {
                  var triggerReady;
                  if (err) {
                    return next(err);
                  }
                  var container = settings.container;
                  if (_.isString(container)) {
                    container = $(container, tabContainer)[0];
                  } 
                  $(container).html(html);
                  disableElement(container);
                  if (readyRegistry[requestId]) {
                    triggerReady = createTriggerReadyFunc(requestId, bundle.version, tab ? tab : browser);
                  } else {
                    triggerReady = function() {};
                  }
                  next(null, bundle, html, function(callback) {
                    enableElement(container);
                    triggerReady(callback);
                  });
                });

            });          
          }
        ], callback);
      }
      
      callbackWrapper = wrapCallbackWithErrorHandlers(tab, 
                          function() {
                            var err = arguments[0];
                            if (err && err.bundle && err.bundle.locals.completeBundleProcess) {
                              processBundle(err.data, err.bundle, function() {
                                onRequestEnd(settings, tab);
                                callback.apply(this, arguments);
                              });
                            } else {
                              onRequestEnd(settings, tab);
                              callback.apply(this, arguments);          
                            }        
                          }, internalCall);
      
      settings.data = settings.data || {};
      settings.headers = settings.headers || {};
      if (settings.viewOnly) settings.data.viewOnly = true;
      settings.headers.Accept = shared.HTML_BUNDLE_MIME_TYPE;

      async.waterfall([

        function(next) {
          var viewOnlyUrlMatchers = cachedBundleOptions.viewOnlyUrlMatchers, 
              viewOnlyMatcherKey,
              parsedFullUrl;

          if (settings.data && _.keys(settings.data).length > 0) {
            var queryString = $.param(settings.data);
            if (settings.url.match(/\?.*=/)) {
              queryString = '&' + queryString;
            } else if (queryString[0] != '?') {
              queryString = '?' + queryString;
            }
            fullUrl = url + queryString;
          }
          parsedFullUrl = shared.parseUrl(fullUrl);
          
          isTempCacheUrl = _.any(cachedBundleOptions.tempUrlMatchers, function(matcher) {
             if (_.isFunction(matcher)) {
                return matcher(fullUrl, parsedFullUrl);
             } else {
               return fullUrl.match(matcher);
             }
          });
          
          if (!localVersion || 
              !settings.type.match(/get/i) || 
              settings.cacheBundle === false ||
              (!inNativeApp && !(isTempCacheUrl && !settings.viewOnly))) {

            var ajaxMethod = browserAjax;
            if (settings.uploadOptions) {
              ajaxMethod = upload;
            }
            onCacheMissOnce();
            return ajaxMethod(url, settings, parseBundle, 
              function(err, data, compiled) {
                if (err) return next(err);

                if (settings.type.match(/post/i) && compiled.Location) {
                  if (internalCall) {
                    if (followRedirects) {
                      callback(new RedirectError(settings, compiled.Location));
                    } else {
                      callbackWrapper(new RedirectError(settings, compiled.Location));
                    }
                  } else if (followRedirects) {
                    browser.request(_.extend({}, settings, {url:compiled.Location}), callback);                      
                  } else {
                    callbackWrapper(new RedirectError(settings, compiled.Location));                    
                  }
                } else {
                  next(err, data, compiled);
                }
              });
          }

          if (settings.viewOnly) {

            viewOnlyMatcherKey = _.find(_.keys(viewOnlyUrlMatchers), 
                                        function(key) {
                                          var matcher = viewOnlyUrlMatchers[key];
                                           if (_.isFunction(matcher)) {
                                            return matcher(fullUrl, parsedFullUrl);
                                           } else {
                                            return fullUrl.match(matcher);
                                          }
                                         });
            if (viewOnlyMatcherKey) {
              getViewOnlyBundleCacheFile(rootUrl, 
                                         localVersion,
                                         shared.resolveUrl(rootUrl, fullUrl),
                                         settings.headers, 
                                         viewOnlyMatcherKey, 
                                         onCacheMissOnce, 
                                         next);

            } else {
              onCacheMissOnce();
              browserAjax(url, settings, parseBundle, next);
            }

          } else if (isTempCacheUrl) {

            tempCacheResource = getTempCacheResource(fullUrl);
            if (tempCacheResource) {
              console.log("Got resource from temp cache: " + fullUrl);
              next(null, null, tempCacheResource);
            } else {
              onCacheMissOnce();
              browserAjax(url, settings, parseBundle, function(err, data, bundle) {
                if (!err) setTempCacheResource(fullUrl, bundle);
                next(err, data, bundle);
               });
            }

          } else if (_.any(cachedBundleOptions.urlMatchers, function(matcher) {
                      if (_.isFunction(matcher)) {
                        return matcher(fullUrl, parsedFullUrl);
                      } else {
                         return fullUrl.match(matcher);
                      }
                    })) {

            getBundleCacheFile(rootUrl, 
                               localVersion, 
                               shared.resolveUrl(rootUrl, fullUrl),
                               settings.headers, 
                               onCacheMissOnce, 
                               next);

          } else {
            onCacheMissOnce();
            browserAjax(url, settings, parseBundle, next);
          }

        },

        function(data, bundle, next) {
          processBundle(data, bundle, next);
        }

      ], callbackWrapper);
      
      return requestId;
    }
         
    function createTab(options) {
      options = options || {};
      var tab,
          stack = [],
          htmlCache = {},
          loadInProgress;
          
      function wrapLoadCallback(loadErrorHandler, callback) {
        var errorHandler = loadErrorHandler || errorHandlers['default'];
        return function() {
          var args = arguments,
              err = args[0];
          if (!err) return callback.apply(this, arguments);
          else {
            loadInProgress = false;
            if (errorHandler) {
              errorHandler(err, tab, function() {
                callback.apply(this, args);
              });
            } else {            
              callback.apply(this, arguments);
            }
          }
        };
      }
          
      function defaultCreateContentContainer() {
        var container = document.createElement('div');
        container.className = 'content-container';
        container.style.display = 'none';
        return container;
      }
      
      tab = {
        browser: browser,
                 
        length: function() { return stack.length; },

        first: function() { return stack[0]; },
        
        last: function() { return stack[stack.length-1]; },

        previous: function() { return stack[stack.length-2]; },
        
        load: function(settings, triggerReadyCallback, isReload) {

          if (loadInProgress) {
            console.log("Ignoring load(), load is in progress.");
            return;
          }
          loadInProgress = true;

          settings = clone(settings);
          var self = this,
              followRedirects = _.isUndefined(settings.followRedirects) ? 
                                  defaultFollowRedirects : settings.followRedirects,
              pushArgs = arguments,
              viewCallbackComplete = false,
              viewLoaded = false,
              shouldLoadView,
              viewStageCtr,
              onLoad = settings.onLoad || {},              
              onCacheMiss = settings.onCacheMiss || defaultOnCacheMiss || function() {},
              loadEverythingCallbackArgs,
              defaultCallback = function(err, bundle, triggerReady) { if (!err) triggerReady(); },
              renderWait,
              lastSettings = self.length() > 0 ? self.last() : null,
              existingContent = lastSettings ? $(self.contentContainer, self.container)[0] : null,
              createContentContainer = self.createContentContainer || defaultCreateContentContainer,
              viewRequestId,
              loadRequestId;

          settings.type = settings.type || "get";
          shouldLoadView = settings.onViewLoad && settings.type.match(/get/i) && !isReload;
          
          function archiveExistingContent() {
            if (isReload || !lastSettings) return;
            if (existingContent) {
              $(existingContent).css('display', 'none');
              lastSettings.content = existingContent;
              existingContent.parentNode.removeChild(existingContent);
            }
          }
          
          function loadView() {
            var viewOnlySettings = _.extend({
                  viewOnly: true
                }, 
                clone(settings)),
                transition = settings.onViewLoad.transition;

            viewOnlySettings.onCacheMiss = onCacheMiss;
                
            viewStageCtr = viewOnlySettings.container = $(createContentContainer())[0];
            $(self.container).append(viewStageCtr);
            
            if (settings.onViewLoad.data) {
              if (viewOnlySettings.data) {
                _.extend(viewOnlySettings.data, settings.onViewLoad.data);
              } else {
                viewOnlySettings.data = settings.onViewLoad.data;
              }
            }
            
            async.waterfall([
              function(next) {
                settings.requestId = viewRequestId = request(viewOnlySettings, next, null, self, true);
              },
              
              function(bundle, html, triggerReady, next) {
                var contentCtr = $(self.contentContainer, self.container)[0];
                function archiveExistingAndCleanReplaced(err) {
                  archiveExistingContent();
                  if (contentCtr.parentNode) contentCtr.parentNode.removeChild(contentCtr);
                  next(err, bundle, html, triggerReady);
                }
                if (!transition) {
                  charlotte.pagetransitions.swap(contentCtr, viewStageCtr, self.container);
                  archiveExistingAndCleanReplaced();
                } else {
                  transition(contentCtr, viewStageCtr, archiveExistingAndCleanReplaced);
                }
              }
                            
            ],  function(err, bundle, html, triggerReady) {
              function triggerReadyWrapper(callback) {
                triggerReady(function() {
                  var args = arguments;
                  viewCallbackComplete = true;
                  _.each([triggerReadyCallback, callback], function(cb) {
                    if (cb) wrapCallbackWithErrorHandlers(self, cb).apply(this, args);
                  });
                  callOnLoadIfReady();
                });
              }
              
              var callback = settings.onViewLoad.callback || defaultCallback,
                  wrapper;
              viewLoaded = true;
              wrapper = wrapLoadCallback(settings.onError, callback);
              wrapper(err, bundle, triggerReadyWrapper, isReload);
              if (err) {
                loadInProgress = false;
                if (settings.onError && callback === defaultCallback) {
                  settings.onError(err, self, function() {});
                } 
              } else {
                 if (!isReload) {
                   stack.push(settings);
                 }
                 loadEverything();
              }
            }); 
          }

          function loadEverything() {
            var loadSettings = clone(settings),
                transition = onLoad.transition,
                loadStageCtr = loadSettings.container = $(createContentContainer())[0];

            $(self.container).append(loadStageCtr);
                
            if (onLoad.data) {
              if (loadSettings.data) {
                _.extend(loadSettings.data, onLoad.data);
              } else {
                loadSettings.data = onLoad.data;
              }
            }
            
            if (loadSettings.isRedirectFromPost) {
              loadSettings.cacheBundle = false;
            }

            loadSettings.onCacheMiss = function(url) { 
              onCacheMiss(url, self, viewLoaded); 
            };
            
            settings.requestId = loadRequestId = request(loadSettings, 
              function(err, bundle, html, triggerReady) {
                if (err instanceof RedirectError && followRedirects) {
                  var location = err.location;
                  loadInProgress = false;
                  loadStageCtr.parentNode.removeChild(loadStageCtr);
                  if (shared.parseUrl(location).path == shared.parseUrl(self.last().url).path) {
                    self.reload(null, true, location);
                  } else if (location == self.previous().url) {
                    self.back();
                    self.reload();
                  } else {
                    self.load({url: err.location, isRedirectFromPost: true});
                  }
                  return;
                }
                
                function triggerReadyWrapper(callback) { 
                  triggerReady(function() {
                    loadInProgress = false;
                    var args = arguments;
                    _.each([triggerReadyCallback, callback], function(cb) {
                      if (cb) wrapCallbackWithErrorHandlers(self, cb).apply(this, args);
                    });
                  });
                }
                loadEverythingCallbackArgs = [err, bundle, triggerReadyWrapper, isReload];
                callOnLoadIfReady(transition, loadStageCtr);
              },
              renderWait, self, true);
          }

          function callOnLoadIfReady(transition, loadStageCtr) {
            var loadErr, bundle, callback, wrapper, contentCtr;

            if ((viewCallbackComplete || !shouldLoadView) && 
                loadEverythingCallbackArgs) {
                  
              loadErr = loadEverythingCallbackArgs[0];
              bundle = loadEverythingCallbackArgs[1];
              callback = onLoad.callback || defaultCallback;
              
              async.waterfall([
                function(next) {
                  if (loadErr) return next(loadErr);
                  var contentCtr = $(self.contentContainer, self.container)[0];
                  function archiveExistingAndCleanReplaced(err) {
                    if (!shouldLoadView) archiveExistingContent();
                    if (contentCtr.parentNode) contentCtr.parentNode.removeChild(contentCtr);
                    next(err);
                  }
                  if (!transition || isReload) {
                    charlotte.pagetransitions.swap(contentCtr, loadStageCtr, {container: self.container});
                    archiveExistingAndCleanReplaced();
                  } else {
                    transition(contentCtr, loadStageCtr, archiveExistingAndCleanReplaced);
                  }
                }
              ], function(err) {
                loadEverythingCallbackArgs[0] = err;
                wrapper = wrapLoadCallback(settings.onError, callback);
                wrapper.apply(this, loadEverythingCallbackArgs);
                if (err) {
                  if (settings.onError && callback == defaultCallback) {
                    settings.onError(err, tab, function() {});
                  }
                } else if (!viewLoaded && settings.type.match(/get/i) && !isReload) {
                  stack.push(settings);
                }
              });
              
            }
          }
          
          settings.url = shared.resolveUrl(rootUrl, settings.url);
          
          if (stack.length > 0) {
            if (settings.uploadOptions) {
              settings.uploadOptions.params = settings.uploadOptions.params || {};
              settings.uploadOptions.params['X-Referer'] = self.last().url;
            } else {
              settings.headers = settings.headers || {};
              settings.headers['X-Referer'] = stack[stack.length-1].url;
            }
          }
                    
          if (shouldLoadView) {
            loadView();
            renderWait = function(renderCallback) {
              function checkViewCallbackComplete() {
                if (viewCallbackComplete) renderCallback();
                else {
                  setTimeout(checkViewCallbackComplete, 100);
                }
              }
              checkViewCallbackComplete();
            };
          } else {
            loadEverything();
          }
        },

        back: function(options) {
          var poppedSettings, lastSettings, onBack, transition, callback, contentCtr;

          if (loadInProgress) {
            console.log("Ignoring back(), load is in progress.");
            return false;
          }

          if (stack.length == 1) {
            console.log("Ignoring back(), no where to go back to.");
            return false;
          }

          poppedSettings = stack.pop();
          onBack = poppedSettings.onBack;
          transition = poppedSettings.onBack.transition;
          callback = poppedSettings.onBack.callback;
          lastSettings = stack[stack.length-1];
          contentCtr = $(this.contentContainer, this.container)[0];
          $(this.container).prepend(lastSettings.content);
          // detach all event handlers on contentCtr before popping
          // to prevent memory leak
          $(contentCtr).off(); 
          if (transition) {
            transition(contentCtr, lastSettings.content, function(err) {
              contentCtr.parentNode.removeChild(contentCtr);              
              if (callback) callback(err, options);
            });
          } else if (callback) {
            charlotte.pagetransitions.swap(contentCtr, lastSettings.content);
            contentCtr.parentNode.removeChild(contentCtr);
            callback(null, options);
          }
          
          
          // TODO: implement this on popped container:
          // http://www.fngtps.com/2010/mobile-safari-image-resource-limit-workaround/
          if (lastSettings && lastSettings.onReturn) {
            lastSettings.onReturn();
          }

          return true;
        },

        reload: function(callback, isRedirectFromPost, newUrl) {
          var settings = this.last();
          this.load(_.extend({isRedirectFromPost: isRedirectFromPost}, 
                    settings, 
                    {url: newUrl ? newUrl : settings.url}), 
                    callback, true);
        },

        stack: stack        
      };
      
      _.each(['baseUrl', 'rootUrl', 'assetRootUrl'], function(name) {
        tab[name] = browser[name];
      });
      _.extend(tab, options);
      _.each(ASSET_METHOD_NAMES, function(name){
        tab[name] = function() {
          charlotte[name].apply(this, arguments);
        }; 
      });
      tab.contentContainer = tab.contentContainer || '#content';
      
      return tab;
    }
    
    browser = {      
      createTab: function(options) {
        var tab = tabs[options.name] = createTab(options);
        if (_.keys(tabs).length == 1) this.switchTab(options.name);
        return tab;
      },
      
      currentTab: function() {
        return currentTab;
      },
      
      switchTab: function(name) {
        var oldTab = currentTab;
        currentTab = tabs[name];
        if (onTabSwitch) onTabSwitch(oldTab, currentTab);
        return currentTab;
      },
                          
      request: function (settings, callback, renderWait) {
        request(settings, callback, renderWait, null, false);
      }
    };
    _.each(['baseUrl', 'rootUrl', 'assetRootUrl'], function(name) {
      browser[name] = charlotte[name];
    });
    _.extend(browser, options);
    _.each(ASSET_METHOD_NAMES, function(name){
      browser[name] = function() {
        charlotte[name].apply(this, arguments);
      }; 
    });
    return browser;
  };  
  
}).call(this);
