const { JSDOM } = require('jsdom');

// JSDOM helpers: create, track, and cleanly close test windows.
const tracked = new Set();

// Create a JSDOM instance and register it for teardown.
function createDom(html, options = {}) {
  const dom = new JSDOM(html, options);
  tracked.add(dom);
  return dom;
}

// Close a tracked JSDOM instance if possible.
function closeDom(dom) {
  if (!dom || !dom.window) return;
  if (typeof dom.window.close === 'function') {
    dom.window.close();
  }
  tracked.delete(dom);
}

// Cleanup any remaining tracked JSDOM instances after a test.
function cleanupDoms() {
  Array.from(tracked).forEach(dom => closeDom(dom));
}

// Hook cleanup into Jest's lifecycle when available.
function registerDomCleanup() {
  if (typeof afterEach === 'function') {
    afterEach(() => cleanupDoms());
  }
}

module.exports = {
  createDom,
  closeDom,
  cleanupDoms,
  registerDomCleanup
};
