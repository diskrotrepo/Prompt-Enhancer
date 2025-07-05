(function (global) {
  var request = new XMLHttpRequest();
  request.open('GET', 'default_list.json', false);
  request.send(null);
  if (request.status >= 200 && request.status < 300) {
    global.DEFAULT_LIST = JSON.parse(request.responseText);
  } else {
    global.DEFAULT_LIST = { presets: [] };
  }
})(typeof window !== 'undefined' ? window : this);
