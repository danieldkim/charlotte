(function() {

  var pagetransitions = charlotte.pagetransitions = {};
  
  function el(elOrSelector, container) {
    if (_.isString(elOrSelector)) {
      return $(elOrSelector, container ? container : undefined)[0];      
    } else {
      return elOrSelector;
    }
  }
    
  function clearAnimationProperties(elements) {
    _.each(arguments, function(el) {
      el = $(el)[0];
      var animProperties = [], prop;
      for (var i = 0; i < el.style.length; i++) {
        prop = el.style[i];
        if (prop.match(/-transform|-transition/)) {
          animProperties.push(prop);
        }
      }
      _.each(animProperties, function(p) { 
        el.style[p] = null;
      });
    });
  }
    
  var restoreScrollPositions = charlotte.util.restoreScrollPositions;
  
  function slideIn(el, options, callback) {
    options = options || {};
    callback = callback || function() {};
    var from = options.from || "right",
        duration = options.duration,
        onYourMarkDescription;

    if (_.isUndefined(duration)) duration = 0.5;
        
    switch (from) {
      case "top":
        onYourMarkDescription = {translateY: -window.innerHeight};
        break;
      case "bottom":
        onYourMarkDescription = {translateY: window.innerHeight};
        break;
      case "left":
        onYourMarkDescription = {translateX: -window.innerWidth};
        break;
      case "right":
        onYourMarkDescription = {translateX: window.innerWidth};
        break;
      default:
        return callback(new Error("invalid from: " + from));
    }
    Firmin.animate(el, onYourMarkDescription, 0);
    $(el).css("display", "block");
    
    setTimeout(function() {
      Firmin.animate(el, {translateY: 0}, duration, function() { if (callback) callback(); });
    }, 0); 

  }
  
  function slideOut(el, options, callback) {
    options = options || {};
    callback = callback || function() {};
    var to = options.to || "bottom",
        duration = options.duration;

    if (_.isUndefined(duration)) duration = 0.5;

    setTimeout(function() {
      var description;
      switch (to) {
        case "top":
          description = {translateY: -window.innerHeight};
          break;
        case "bottom":
          description = {translateY: window.innerHeight};
          break;
        case "left":
          description = {translateX: -window.innerWidth};
          break;
        case "right":
          description = {translateX: window.innerWidth};
          break;
        default:
          return callback(new Error("invalid to: " + to));
      }
      Firmin.animate(el, description, duration, function() { if (callback) callback(); });
    }, 0);
    
  }
  
  function takeOver(contentCtr, contentStageCtr, beforeClearAnimProps) {
    var contentStageCtrId = contentStageCtr.id;
    contentStageCtr.id = contentCtr.id;
    contentStageCtr.style = null;
    contentCtr.id = contentStageCtrId;
    $(contentCtr).css('display', 'none');
    $(contentStageCtr).css('display', 'block');
    // animation is to force a reflow of staged content
    Firmin.animate(contentStageCtr, {translateY: window.innerHeight}, 0);
    setTimeout(function() {
      Firmin.animate(contentStageCtr, {translateY: 0}, 0);
    },0);
    if (beforeClearAnimProps) beforeClearAnimProps();
    clearAnimationProperties(contentCtr, contentStageCtr);    
  }
  
  pagetransitions.clearAnimationProperties = clearAnimationProperties;
  
  /**
   * Content is swapped with existing content with no animation. 
   *
   * @param {HTMLElement} contentCtr The container holding the currently
   *   viewable content, to be swapped out.
   * @param {HTMLElement} contentStageCtr The container holding the content
   *   to swap in.
   * @param {Object} options Options are:
   *   container: The container holding both the contentCtr and 
   *     contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *     they will be scoped to this container.
   */  
  pagetransitions.swap = function(contentCtr, contentStageCtr, options) {
    var container;
    options = options || {};
    container = options.container;
    contentCtr = el(contentCtr, container);
    contentStageCtr = el(contentStageCtr, container);
    restoreScrollPositions(contentStageCtr);
    takeOver(contentCtr, contentStageCtr);
  };
  
  /**
   * Content slides into viewing area over existing content. 
   *
   * @param {HTMLElement} contentCtr The container holding the currently
   *   viewable content.
   * @param {HTMLElement} contentStageCtr The container holding the content
   *   to be slid in.
   * @param {Function} callback Function to call when transition is complete.
   * @param {Object} options Options are:
   *   container: The container holding both the contentCtr and 
   *     contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *     they will be scoped to this container.
   *   duration: duration of the animation for the transition.
   *   from: the side from which the slide should originate.  valid values are
   *     "top", "bottom", "left", and "right". default is "right".
   * @param {Function} callback Function to call when transition is complete.
   */  
  pagetransitions.slideOver = function(contentCtr, contentStageCtr, options, callback) {
    var container;
    options = options || {};
    container = options.container;
    contentCtr = el(contentCtr, container);
    contentStageCtr = el(contentStageCtr, container);
    contentStageCtrId = contentStageCtr.id;
    
    $(contentCtr).after(contentStageCtr);
    slideIn(contentStageCtr, options, function() {
      if (options.takeover !== false) {
        takeOver(contentCtr, contentStageCtr);
      }
      if (callback) callback();
    });

    restoreScrollPositions(contentStageCtr);
  };
  
  /**
   * Content slides out of viewing area. 
   *
   * @param {HTMLElement} contentCtr The container holding the currently
   *   viewable content, to be slid out.
   * @param {HTMLElement} contentStageCtr The container holding the content
   *   to be revealed upon slide out of currently viewable content.
   * @param {HTMLElement} container The container holding both the contentCtr 
   *   and contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *   they will be scoped to this ctr.
   * @param {Object} options Options are:
   *   container: The container holding both the contentCtr and 
   *     contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *     they will be scoped to this container.
   *   duration: duration of the animation for the transition.
   *   to: the side to which the slide should go.  valid values are
   *     "top", "bottom", "left", and "right".  default is "right".
   * @param {Function} callback Function to call when transition is complete.
   */  
  pagetransitions.slideOut = function(contentCtr, contentStageCtr, options, callback) {
    var container;
    options = options || {};
    container = options.container;
    contentCtr = el(contentCtr, container);
    contentStageCtr = el(contentStageCtr, container);
    contentStageCtrId = contentStageCtr.id;

    $(contentStageCtr).css("display", "block");
    $(contentStageCtr).after(contentCtr);
    Firmin.translate(contentStageCtr, {x:0, y:0}, 0);
    slideOut(contentCtr, options, function() {
      if (options.takeover !== false) {
        takeOver(contentCtr, contentStageCtr);
      }
      if (callback) callback();        
    });

    restoreScrollPositions(contentStageCtr);
  };

  /**
   * Content slides into viewing area, pushing existing content out.  
   *
   * @param {HTMLElement} contentCtr The container holding the currently
   *   viewable content, to be pushed out.
   * @param {HTMLElement} contentStageCtr The container holding the content
   *   that pushes into the viewing area.
   * @param {Object} options Options are:
   *   container: The container holding both the contentCtr and 
   *     contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *     they will be scoped to this container.
   *   duration: duration of the animation for the transition.
   *   from: the side from which the push should originate.  valid values are
   *     "top", "left", and "right".  default is "right".
   * @param {Function} callback Function to call when transition is complete.
   */  
  pagetransitions.pushIn = function(contentCtr, contentStageCtr, options, callback) {
    var container;
    options = options || {};
    container = options.container;
    contentCtr = el(contentCtr, container);
    contentStageCtr = el(contentStageCtr, container);
    contentStageCtrId = contentStageCtr.id;
    outOptions = _.extend({}, options);
    
    switch (options.from) {
      case "top":
        outOptions.to = "bottom";
        break;
      case "left":
        outOptions.to = "right";
        break;
      case "right":
        outOptions.to = "left";
        break;
      default:
        return callback(new Error("invalid from: " + from));
    }
    
    async.parallel([
      async.apply(slideIn, contentStageCtr, options),
      async.apply(slideOut, contentCtr, outOptions)
    ], function(err) {
      if (options.takeover !== false) {
        takeOver(contentCtr, contentStageCtr);
      }
      if (callback) callback(err);
    });
    
    restoreScrollPositions(contentStageCtr);
  };
  
  /**
   * New content zooms into viewing area, while existing content zooms out.
   *
   * @param {HTMLElement} contentCtr The container holding the currently
   *   viewable content, to be zoomed out.
   * @param {HTMLElement} contentStageCtr The container holding the content
   *   to be zoomed in.
   *   
   * @param {Object} options Options are:
   *   container: The container holding both the contentCtr and 
   *     contentStageCtr.  if contentCtr and contentStageCtr are selectors,
   *     they will be scoped to this container.
   *   duration: duration of the animation for the transition.
   * @param {Function} callback Function to call when transition is complete.
   */  
  pagetransitions.zoomIn = function(contentCtr, contentStageCtr, options, callback) {
    var container;
    options = options || {};
    container = options.container;
    contentCtr = el(contentCtr, container);
    contentStageCtr = el(contentStageCtr, container);
    contentStageCtrId = contentStageCtr.id;
    duration = options.duration;
    
    if (_.isUndefined(duration)) duration = 1;

    Firmin.animate(contentStageCtr, {scale: {x: 0.01, y: 0.01}, opacity: 0}, 0);
    $(contentStageCtr).css("display", "block");
    // $(contentStageCtr).after(contentCtr);
    setTimeout(function() {
      Firmin.animate(contentCtr, {
        scale: { x: 0.01, y:0.01 }, 
        origin: { x: "0%", y:  window.innerHeight + "px"},
        opacity: 0
      }, duration);
      Firmin.animate(contentStageCtr, {
          scale: { x: 1, y: 1 }, 
          origin: { x: "0%", y: "0%"},
          opacity: 1
        }, duration, function() {
          if (options.takeover !== false) {
            takeOver(contentCtr, contentStageCtr, function() {
              Firmin.animate(contentCtr, {scale: {x: 1, y: 1}, opacity: 1}, 0);              
            });
          }
          if (callback) callback();
        });
    }, 0);

    restoreScrollPositions(contentStageCtr);
  };
  
  pagetransitions.createTransitioner = function(options) {
    
    var transitioner =  {};
        
    _.each(['swap', 'slideOver', 'slideOut', 'pushOut', 'pushIn', 'zoomIn'], function(name) {
      transitioner[name] = function() {
        var args = Array.prototype.slice.call(arguments);
        args[2] = _.extend({}, args[2] || {}, options);
        pagetransitions[name].apply(this, args);
      };
    });
    
    return transitioner;
  };

})();