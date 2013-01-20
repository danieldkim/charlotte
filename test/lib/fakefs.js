(function() {
  
  var removeUrlMultislashes,
      LocalFileSystem = {
        PERSISTENT: 0
      },
      uploadHandler,
      downloadHandler;
      
  
  function requestFileSystem(type, size, successCallback, errorCallback) {
    successCallback(fakeFileSystem);
  }
  
  function clearFileSystem() {
    fakeFileSystem.root = createEntry();
  }
  
  function onFileUpload(handler) {
    uploadHandler = handler;
  }
  
  function onFileDownload(handler) {
    downloadHandler = handler;
  }
  
  var exportee;  
  if (typeof module !== 'undefined' && module.exports) {
    removeUrlMultislashes = require('path').normalize;
    exportee = module.exports;
    
  } else {
    removeUrlMultislashes = charlotte.util.removeUrlMultislashes;
    exportee = this;
  }
  [
    'onFileUpload', 'onFileDownload', 'requestFileSystem', 'LocalFileSystem', 'clearFileSystem', 
    'FileError', 'FileTransfer'
  ].forEach(function(name) {
    exportee[name] = eval(name);
  });

  
  var root = createEntry(),  
      fakeFileSystem = {
        root: root
      },
      canCaptureStack = !!Error.captureStackTrace;

  function FileError(code, message) {  
    this.name = "FileError";
    this.code = code;
    this.message = message || "Error in file operation";  
    if (canCaptureStack) Error.captureStackTrace(this, arguments.callee);
  }
      
  // File error codes
  // Found in DOMException
  FileError.NOT_FOUND_ERR = 1;
  FileError.SECURITY_ERR = 2;
  FileError.ABORT_ERR = 3;

  // Added by File API specification
  FileError.NOT_READABLE_ERR = 4;
  FileError.ENCODING_ERR = 5;
  FileError.NO_MODIFICATION_ALLOWED_ERR = 6;
  FileError.INVALID_STATE_ERR = 7;
  FileError.SYNTAX_ERR = 8;
  FileError.INVALID_MODIFICATION_ERR = 9;
  FileError.QUOTA_EXCEEDED_ERR = 10;
  FileError.TYPE_MISMATCH_ERR = 11;
  FileError.PATH_EXISTS_ERR = 12;
  
  function FileTransfer() {};

  FileTransfer.prototype.upload = function(filePath, server, successCallback, errorCallback, options) {
    uploadHandler.apply(this, arguments);
  };

  FileTransfer.prototype.download = function(source, target, successCallback, errorCallback) {
    downloadHandler.apply(this, arguments);
  };
  
  function createEntry(isFile, parent, name) {
    var entry,
        parent,
        children = {};
        
    function getEntry(isFile, path, options, successCallback, errorCallback) {
      if (typeof path === "string") path = removeUrlMultislashes(path).split('/');
      if (path[0] == '') {
        return root.getEntry(isFile, path.slice(1), options, 
                             successCallback, errorCallback);
      }
      var childName = path[0],
          child = children[path[0]];
      if (path.length == 1) {
        if (!child && options.create) {
          children[childName] = child = createEntry(isFile, entry, childName);
        }
        if (child && child.isFile === isFile) successCallback(child);
        else errorCallback(new FileError(FileError.NOT_FOUND_ERR));
      } 
      else if (!child) errorCallback(new FileError(FileError.NOT_FOUND_ERR));
      else child.getEntry(isFile, path.slice(1), options, successCallback, errorCallback);
    }
        
    entry = {
      parent: parent,
      fullPath: removeUrlMultislashes(
                  (parent ? parent.fullPath || '' : '') + '/' + (name || '')
                ),
      name: name,
      isDirectory: !isFile,
      isFile: isFile,
      getEntry: getEntry,
      file: function(successCallback, errorCallback) {
        successCallback({
          size: entry.data ? entry.data.length : undefined
        });
      }
    };
    
    if (isFile) {
      entry.createWriter = function(successCallback, errorCallback) {
        successCallback({
          write: function(data) {
            entry.data = data;
            this.onwrite();
          }
        });
      }
    } else {
      entry.getDirectory = function(path, options, successCallback, errorCallback) {
        getEntry(false, path, options, successCallback, errorCallback);
      }
      
      entry.getFile = function(path, options, successCallback, errorCallback) {
        getEntry(true, path, options, successCallback, errorCallback);
      }
    }
    
    return entry;
  }
    
})();
