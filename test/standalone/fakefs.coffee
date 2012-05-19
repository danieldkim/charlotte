should = require('chai').should()
fakefs = require('fakefs')
async = require('async')

describe 'fakefs', ->
  fs = null
  
  before (done) ->
    fakefs.requestFileSystem fakefs.LocalFileSystem.PERSISTENT, 0, (requestedFs) ->
      fs = requestedFs
      done();
      
  afterEach ->
    fakefs.clearFileSystem();
    
  it 'should create directories', (done) ->
    async.waterfall [
      (next) ->
        fs.root.getDirectory '/foo', {create: true}, 
          (dir) ->
            dir.should.exist
            dir.isDirectory.should.equal true
            dir.isFile.should.equal false
            dir.name.should.equal 'foo'
            next()
          ,
          next
      ,
      (next) ->
        fs.root.getDirectory '/foo/bar', {create: true}, 
          (dir) ->
            dir.should.exist
            dir.isDirectory.should.equal true
            dir.isFile.should.equal false
            dir.name.should.equal 'bar'
            dir.fullPath.should.match /foo\/bar/
            next()
          ,
          next
      
    ], (err) ->
      err.should.not.exist if err
      done()

  it 'should create files', (done) -> 
    async.waterfall [
      (next) ->
        fs.root.getDirectory 'foo', {create: true},
          (dir) ->
            next(null, dir)
          ,
          next
      ,
      (dir, next) ->
        dir.getFile 'bar', {create: true}, 
          (file) ->
            file.should.exist
            file.isDirectory.should.equal false
            file.isFile.should.equal true
            file.name.should.equal 'bar'
            file.fullPath.should.match /foo\/bar/
            next()
          ,
          next
      
    ], (err) ->
      err.should.not.exist if err
      done()
      
  it 'should generate error for non-existent files/directories', ->
    ['getFile', 'getDirectory'].forEach (name) ->
      fs.root[name] 'foo', {create: false},
        (dir) ->
          dir.should.not.exist
        ,
        (err) ->
          err.should.exist

  it 'should write files', (done) ->
    data = 'foo'
    async.waterfall [
      (next) ->
        fs.root.getFile 'bar', {create: true}, 
          (file) ->
            next(null, file)
          ,
          next
      ,    
      (file, next) ->
        file.createWriter (writer) ->
          next(null, writer)
      ,
      (writer, next) ->
        writer.onwrite = () ->
          next()
        writer.write(data)
    ], (err) ->
      err.should.not.exist if err
      done()
          
  it 'should download files', (done) ->
    fakefs.onFileDownload (source, target, successCallback, errorCallback)  ->
      successCallback()
    ft = new fakefs.FileTransfer()
    ft.download 'foo', 'bar', ->
      done()
    