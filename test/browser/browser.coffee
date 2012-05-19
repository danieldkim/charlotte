should = chai.should()
chai.Assertion.includeStack = true;

describe 'browser', ->

  server = null
  browser = null
  inChrome = !!navigator.userAgent.match(/Chrome/)

  before ->
    charlotte.ignoreAssetLoadErrors()
    browser = charlotte.createBrowser rootUrl: 'http://foo.bar/'

  after ->
    charlotte.unignoreAssetLoadErrors()
  
  describe 'request', ->
    fooVal = 'bar'
    
    request = (callback) -> 
      browser.request 
          url: '/foo'
          container: '#content'
        , 
        callback
        
    afterEach ->
      $('#content').html ''
      tagAttributes = link: 'href', script: ['src', '__src'], img: 'src', style: '__href'
      for tag, attributes of tagAttributes
        attributes = [attributes] if not _.isArray attributes
        for attribute in attributes
            $("#{tag}[#{attribute}*='foo.bar']").remove()
    describeRendering = () ->

      describe 'rendering', ->  

        fooBundle =
          template: '/foo'
          locals:
            layoutBody: false
            foo: 'bar'

        fooTemplate = '''
                      h1 #{foo}
                      '''        
        responses = 
          'version': '1.0'
          '/foo': JSON.stringify fooBundle
          '/foo.jade': fooTemplate

        before ->
          sinon.stub $, 'ajax', (settings) ->
            settings.success responses[charlotte.util.parseUrl(settings.url).path]

        after ->
          $.ajax.restore()

        it 'should load content into specified container', (done) ->
          request (err, bundle, html, triggerReady) ->
            $('#content h1').html().should.match ///#{fooVal}///
            done()

        it 'should return bundle', (done) ->
          request (err, bundle, html, triggerReady) ->
            bundle.template.should.equal fooBundle.template
            bundle.locals.foo.should.equal fooBundle.locals.foo
            done()

        it 'should return html', (done) ->
          request (err, bundle, html, triggerReady) ->
            html.should.match /<h1>/
            html.should.match ///#{fooVal}///
            done()      


    describeVersioningOff = ->

      describe 'versioning off', ->

        fooBundle =
          template: '/foo'
          locals:
            layoutBody: false
            foo: 'bar'
            
        fooTemplate = '''
                      h1 #{foo}
                      = stylesheets('/foo')
                      = javascripts('/foo')
                      = img({src: '/foo.jpg'})
                      '''        
        responses = 
          '/version' : ''
          '/foo'     : JSON.stringify fooBundle
          '/foo.css' : 'h1 {}'
          '/foo.js'  : '(function() {})();'
          '/foo.jade': fooTemplate
          
        responseCounts = null
        
        before ->
          sinon.stub $, 'ajax', (settings) ->
            path = charlotte.util.parseUrl(settings.url).path
            responseCounts[path] ||= 0
            responseCounts[path]++
            response = responses[path]
            if response? 
              settings.success response
            else 
              settings.error {status: 404} 
            
        beforeEach ->
          responseCounts = {}
          
        after ->
          $.ajax.restore()

        it 'should not version asset urls', (done) ->
          request (err, bundle, html, triggerReady) ->
            tagAttributes = link: 'href', script: (inChrome ? 'src' : '__src'), img: 'src', style: '__href'
            _.select(responseCounts, (v, k) -> k.match /versions/).should.be.empty
            for tag, attribute of tagAttributes
              $("#{tag}[#{attribute}^='http://foo.bar/versions']").should.be.empty
            should.not.exist(err)
            done()
        
        it 'should always request assets', (done) ->
          previousIds = {}
          tagAttributes = null
          if inChrome 
            tagAttributes = link: 'href', script: 'src'
          else 
            tagAttributes = style: '__href', script: '__src'
          async.waterfall [
            (next) ->
              request (err, bundle, html, triggerReady) ->
                responseCounts["/foo.jade"].should.equal 1
                for tag, attribute of tagAttributes
                  previousIds[tag] = $("#{tag}[#{attribute}*='foo.bar']")[0].id
                next()
            ,
            (next) ->
              request (err, bundle, html, triggerReady) ->
                responseCounts["/foo.jade"].should.equal 2
                for tag, attribute of tagAttributes
                  _.any($("#{tag}[#{attribute}*='foo.bar']"), 
                        (tagObj) -> tagObj.id != previousIds[tag]).should.be.true
                next()
              
          ], (err) ->
            should.not.exist(err)
            done()

    describeVersioningOnSharedBehaviors = () ->
      
      describe 'versioning on shared behaviors', ->
        
        it 'shoud version asset urls'
        
        it 'should cache assets in memory'
        
    describe 'non-native context', ->
      
      describeRendering()

      describeVersioningOff()
      
      describeVersioningOnSharedBehaviors()
      
    describe 'native context', ->
      
      before ->
        charlotte.setInNativeApp(true);
        
      after ->
        charlotte.setInNativeApp(false);
        
      afterEach ->
        localStorage.removeItem('version')
                
      describeRendering()
      
      describeVersioningOff()

      describeVersioningOnSharedBehaviors()
      
      describe 'caching',  ->
        
        fooBundle =
          version: '1.0'
          template: '/foo'
          locals:
            layoutBody: false
            foo: 'bar'
            
        fooTemplate = '''
                      h1 #{foo}
                      = stylesheets('/foo')
                      = javascripts('/foo')
                      '''        
        responses = 
          '/foo'                   : JSON.stringify fooBundle
          '/versions/1.0/foo.jade' : fooTemplate
          '/versions/1.0/foo.css'  : 'h1 {}'
          '/versions/1.0/foo.js'   : '(function() {})();'
          
        requestTypeCounts = null
        
        initRequestTypeCounts = () ->
          requestTypeCounts = 
            cacheSeed: 0
            file: 0
            http: 0
          
        before ->
          onFileDownload (source, target, successCallback, errorCallback)  ->
            successCallback()
            
          sinon.stub $, 'ajax', (settings) ->
            url = settings.url
            if url.match /cache_seed/ 
              requestTypeCounts.cacheSeed += 1 
              settings.error {status: 404}
            else if url.match /^file/
              requestTypeCounts.file += 1 
              relPath = url.match(/\/versions\/1\.0\/.*$/)[0]
              settings.success responses[relPath]
            else if url.match /^http/
              requestTypeCounts.http += 1 
              settings.success responses[charlotte.util.parseUrl(url).path]

        beforeEach ->
          initRequestTypeCounts()
        
        afterEach ->
          clearFileSystem()
          
        after ->
          $.ajax.restore()
        
        
        it 'should cache assets', (done)->
          previousIds = {}
          tagAttributes = link: 'href', script: 'src'
          async.waterfall [
            (next) -> 
              request next
            ,
            (bundle, html, triggerReady, next) ->
              $('#content h1').html().should.match ///#{fooVal}///
              requestTypeCounts.http.should.equal 3
              for tag, attribute of tagAttributes
                previousIds[tag] = $("#{tag}[#{attribute}*='foo.bar']")[0].id
              request next
            ,
            (bundle, html, triggerReady, next) ->
              $('#content h1').html().should.match ///#{fooVal}///
              requestTypeCounts.http.should.equal 4
              for tag, attribute of tagAttributes
                _.any($("#{tag}[#{attribute}*='foo.bar']"), 
                      (tagObj) -> tagObj.id != previousIds[tag]).should.be.false
              next()
          ], (err) ->
            should.not.exist(err)
            done()


