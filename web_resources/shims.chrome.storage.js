
var chrome = chrome || {};
chrome.storage = chrome.storage || {};
chrome.storage.sync = chrome.storage.sync || {};

(function(){
  var callbackIndex = 0;
  var callbacks = [];
  var emptyCallback = function() {};
  
  var cacheCallback = function(callback) {
    var key = btoa(window.crypto.getRandomValues(new Uint32Array(1)) * 100 + (callbackIndex++ % 100));
    callbacks[key] = callback || emptyCallback;
    return key;
  }
  
  chrome.storage.sync.get = function(payload, callback) {
    var key = cacheCallback(callback);
    window.postMessage({ type: "storage.get.request", payload: payload, callbackIndex: key }, "*");
  }

  chrome.storage.sync.set = function(payload, callback) {
    var key = cacheCallback(callback);
    window.postMessage({ type: "storage.set.request", payload: payload, callbackIndex: key }, "*");
  }

  chrome.storage.sync.remove = function(payload, callback) {
    var key = cacheCallback(callback);
    window.postMessage({ type: "storage.remove.request", payload: payload, callbackIndex: key }, "*");
  }

  chrome.storage.sync.clear = function(payload, callback) {
    var key = cacheCallback(callback);
    window.postMessage({ type: "storage.clear.request", payload: payload, callbackIndex: key }, "*");
  }
  
  window.addEventListener('message', function(event) {
    if (event.source != window) return;
    if ((event.data.type || false) == false) return;
    
    switch (event.data.type)
    {
      case 'storage.get.response':
      case 'storage.set.response':
      case 'storage.remove.response':
      case 'storage.clear.response':
        callbacks[event.data.callbackIndex](event.data.result);
        delete callbacks[event.data.callbackIndex];
      break;
    }
  });
})();
