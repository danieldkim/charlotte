var system = require('system');

/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3001, //< Default Max Timeout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    // console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 100); //< repeat check every 100ms
};

var htmlFiles = [],
    page = require('webpage').create(),
    passCount = 0,
    failureCount = 0,
    totalDuration = 0,
    pagesCompletedCount = 0;
    
// Route "console.log()" calls from within the Page context to the main Phantom context (i.e. current "this")
page.onConsoleMessage = function(msg) {
    console.log(msg);
};

if (system.args.length !== 2) {
  var fs = require('fs');
  fs.list('./browser').forEach(function(name) { 
    if (name.match(/html$/)) {
      htmlFiles.push('./browser/' + name);
    }
  });
} else {
  htmlFiles.push(phantom.args[0]);
}

htmlFiles.forEach(function(file) {
  page.open(file, function(status) {
    if (status !== "success") {
      console.log("Unable to access network");
      phantom.exit();
    } else {
      waitFor(function() {
        return page.evaluate(function() {
          if ($('#done').html()) {
            return true;
          }
          return false;
        });
      }, function() {
        var result = page.evaluate(function() {
          var texts = {};
          ['passes', 'failures', 'duration'].forEach(function(type) {
            texts[type] = $('.' + type).text();
          });
          passCount = texts.passes.match(/\b\d+/)[0]*1;
          failureCount = texts.failures.match(/\b\d+/)[0]*1;
          console.log(_.values(texts).join(', '));
          return _.map(['passes', 'failures', 'duration'], function(textType) {
            return texts[textType].match(/\b[\d\.]+/)[0]*1;
          });
        });
        passCount += result[0];
        failureCount += result[1];
        totalDuration += result[2];
        pagesCompletedCount += 1;
      });
    }
  }); 
});

waitFor(
  function() {
    return pagesCompletedCount == htmlFiles.length;
  },
  function() {
    console.log(passCount + " tests passed, " + failureCount + " failed. Duration: " + totalDuration + "s.")
    phantom.exit(!failureCount ? 0 : 1);    
  });
