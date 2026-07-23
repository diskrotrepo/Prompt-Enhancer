/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const CSS_PATH = path.join(ROOT, 'src', 'style.css');

function setupDom(options = {}) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  const mobile = options.mobile === true;
  window.alert = () => {};
  window.requestAnimationFrame = cb => cb();
  window.matchMedia = jest.fn(() => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {}
  }));
  if (options.persistedState && window.localStorage) {
    const raw =
      typeof options.persistedState === 'string'
        ? options.persistedState
        : JSON.stringify(options.persistedState);
    window.localStorage.setItem('promptEnhancerMixData', raw);
  }
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return { window };
}

function openWindow(window, type) {
  const menuItem = window.document.querySelector(`.menu-item[data-window="${type}"]`);
  if (menuItem) menuItem.click();
}

function dispatchPointer(window, target, type, coords = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', { value: coords.clientX ?? 0 });
  Object.defineProperty(event, 'clientY', { value: coords.clientY ?? 0 });
  Object.defineProperty(event, 'pointerId', { value: coords.pointerId ?? 1 });
  target.dispatchEvent(event);
}

function sampleProceduralTitles(rounds = 16) {
  const { window } = setupDom();
  openWindow(window, 'prompts');
  const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
  const root = promptWindow?.querySelector('.mix-root');
  const addMixButton = promptWindow?.querySelector('.add-root-mix');
  const addStringButton = promptWindow?.querySelector('.add-root-chunk');
  for (let i = 0; i < rounds; i += 1) {
    addMixButton.click();
    addStringButton.click();
  }
  const mixTitles = Array.from(root.querySelectorAll('.mix-box .box-title'))
    .map(titleEl => (titleEl?.value || titleEl?.textContent || '').trim())
    .filter(Boolean)
    .slice(1, rounds + 1);
  const chunkTitles = Array.from(root.querySelectorAll('.chunk-box .box-title'))
    .map(titleEl => (titleEl?.value || titleEl?.textContent || '').trim())
    .filter(Boolean)
    .slice(1, rounds + 1);
  return { mixTitles, chunkTitles };
}

describe('Window behavior', () => {
  test('window header collapse hides and taskbar click restores', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const collapseButton = promptWindow?.querySelector('.window-header .collapse-toggle');
    const taskButton = window.document.querySelector('.taskbar-button[data-instance="prompts-1"]');
    expect(promptWindow).not.toBeNull();
    expect(taskButton).not.toBeNull();
    expect(taskButton.classList.contains('active')).toBe(true);

    collapseButton.click();
    expect(promptWindow.classList.contains('is-hidden')).toBe(true);
    expect(taskButton.classList.contains('active')).toBe(false);

    taskButton.click();
    expect(promptWindow.classList.contains('is-hidden')).toBe(false);
    expect(taskButton.classList.contains('active')).toBe(true);
  });

  test('Help Mode explains a title-bar icon without performing its window action', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const helpButton = promptWindow.querySelector('.help-toggle');
    const overlay = promptWindow.querySelector('.help-overlay');
    const minimizeButton = promptWindow.querySelector('.window-header .collapse-toggle');
    window.document.elementFromPoint = jest.fn(() => minimizeButton);

    helpButton.click();
    overlay.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10
    }));

    expect(promptWindow.classList.contains('is-hidden')).toBe(false);
    expect(promptWindow.querySelector('.help-popover').classList.contains('is-hidden')).toBe(false);
    expect(promptWindow.querySelector('.help-popover-short').textContent).toBe('Minimize this window.');
  });

  test('window close removes the window and taskbar button', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const closeButton = promptWindow?.querySelector('.window-header .remove-box');
    expect(promptWindow).not.toBeNull();
    expect(window.document.querySelectorAll('.taskbar-button').length).toBe(1);

    closeButton.click();
    expect(window.document.querySelector('.app-window[data-window="prompts"]')).toBeNull();
    expect(window.document.querySelectorAll('.taskbar-button').length).toBe(0);
  });

  test('desktop maximize toggle switches maximized state on and off', () => {
    const { window } = setupDom({ mobile: false });
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const maximizeButton = promptWindow?.querySelector('.window-header .maximize-toggle');
    expect(promptWindow.classList.contains('is-maximized')).toBe(false);

    maximizeButton.click();
    expect(promptWindow.classList.contains('is-maximized')).toBe(true);
    maximizeButton.click();
    expect(promptWindow.classList.contains('is-maximized')).toBe(false);
  });

  test('mobile maximize toggle always keeps maximized state on', () => {
    const { window } = setupDom({ mobile: true });
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const maximizeButton = promptWindow?.querySelector('.window-header .maximize-toggle');
    promptWindow.classList.remove('is-maximized');

    maximizeButton.click();
    expect(promptWindow.classList.contains('is-maximized')).toBe(true);
    maximizeButton.click();
    expect(promptWindow.classList.contains('is-maximized')).toBe(true);
  });

  test('pointer presses anywhere inside a window activate it without swallowing controls', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const promptWindows = Array.from(window.document.querySelectorAll('.app-window[data-window="prompts"]'));
    const [firstWindow, secondWindow] = promptWindows;
    const firstBody = firstWindow.querySelector('.prompt-body');
    const firstAddMix = firstWindow.querySelector('.add-root-mix');
    const firstTaskButton = window.document.querySelector('.taskbar-button[data-instance="prompts-1"]');
    const initialMixCount = firstWindow.querySelectorAll('.mix-box').length;
    expect(secondWindow.classList.contains('is-focused')).toBe(true);

    dispatchPointer(window, firstBody, 'pointerdown', { clientX: 80, clientY: 180 });

    expect(firstWindow.classList.contains('is-focused')).toBe(true);
    expect(secondWindow.classList.contains('is-focused')).toBe(false);
    expect(firstTaskButton.classList.contains('active')).toBe(true);
    expect(Number(firstWindow.style.zIndex)).toBeGreaterThan(Number(secondWindow.style.zIndex));

    dispatchPointer(window, firstAddMix, 'pointerdown', { clientX: 100, clientY: 500 });
    firstAddMix.click();
    expect(firstWindow.querySelectorAll('.mix-box')).toHaveLength(initialMixCount + 1);
  });

  test('dragging stays pointer-anchored beyond an edge before release commits the snap', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const header = promptWindow?.querySelector('.window-header');
    expect(area).not.toBeNull();
    expect(promptWindow).not.toBeNull();
    expect(header).not.toBeNull();

    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    promptWindow.getBoundingClientRect = () => ({
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    });

    dispatchPointer(window, header, 'pointerdown', { clientX: 260, clientY: 230, pointerId: 7 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 10, clientY: 52, pointerId: 7 });

    expect(promptWindow.style.left).toBe('-30px');
    expect(promptWindow.style.top).toBe('-20px');
    expect(10 - parseFloat(promptWindow.style.left)).toBe(40);
    expect(52 - (42 + parseFloat(promptWindow.style.top))).toBe(30);
    expect(area.querySelector('.window-snap-preview')?.dataset.snapTarget).toBe('top-left');

    dispatchPointer(window, window.document, 'pointerup', { clientX: 10, clientY: 52, pointerId: 7 });
    expect(promptWindow.dataset.snapTarget).toBe('top-left');
    expect(promptWindow.style.left).toBe('0px');
    expect(promptWindow.style.top).toBe('0px');
  });

  test('floating drag can end partially outside the desktop away from a snap threshold', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const header = promptWindow.querySelector('.window-header');
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    promptWindow.getBoundingClientRect = () => ({
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    });

    dispatchPointer(window, header, 'pointerdown', { clientX: 800, clientY: 230, pointerId: 8 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 100, clientY: 100, pointerId: 8 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 100, clientY: 100, pointerId: 8 });

    expect(promptWindow.style.left).toBe('-480px');
    expect(promptWindow.style.top).toBe('28px');
    expect(promptWindow.dataset.snapTarget).toBeUndefined();
  });

  test('resize reaches the desktop right and bottom edges without overshooting', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const handle = promptWindow.querySelector('.resize-handle[data-resize-edge="se"]');
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    promptWindow.style.left = '220px';
    promptWindow.style.top = '158px';
    promptWindow.style.width = '640px';
    promptWindow.style.height = '420px';
    promptWindow.getBoundingClientRect = () => {
      const left = 220;
      const top = 200;
      const width = parseFloat(promptWindow.style.width) || 640;
      const height = parseFloat(promptWindow.style.height) || 420;
      return { left, top, width, height, right: left + width, bottom: top + height };
    };

    dispatchPointer(window, handle, 'pointerdown', { clientX: 860, clientY: 620, pointerId: 9 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 1600, clientY: 1300, pointerId: 9 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 1600, clientY: 1300, pointerId: 9 });

    expect(promptWindow.style.width).toBe('980px');
    expect(promptWindow.style.height).toBe('742px');
  });

  test('floating windows expose every edge and corner and northwest resize keeps opposites fixed', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const handles = promptWindow.querySelectorAll('.resize-handle[data-resize-edge]');
    expect(handles).toHaveLength(8);
    expect(Array.from(handles).map(handle => handle.dataset.resizeEdge).sort()).toEqual(
      ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']
    );

    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    promptWindow.style.left = '220px';
    promptWindow.style.top = '158px';
    promptWindow.style.width = '640px';
    promptWindow.style.height = '420px';
    promptWindow.getBoundingClientRect = () => {
      const left = parseFloat(promptWindow.style.left);
      const top = 42 + parseFloat(promptWindow.style.top);
      const width = parseFloat(promptWindow.style.width);
      const height = parseFloat(promptWindow.style.height);
      return { left, top, width, height, right: left + width, bottom: top + height };
    };

    const northwest = promptWindow.querySelector('[data-resize-edge="nw"]');
    dispatchPointer(window, northwest, 'pointerdown', { clientX: 220, clientY: 200, pointerId: 19 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 100, clientY: 120, pointerId: 19 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 100, clientY: 120, pointerId: 19 });

    expect(promptWindow.style.left).toBe('100px');
    expect(promptWindow.style.top).toBe('78px');
    expect(promptWindow.style.width).toBe('760px');
    expect(promptWindow.style.height).toBe('500px');
  });

  test('side-edge release snaps to a flush half and opens the complementary chooser', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const [firstWindow] = Array.from(window.document.querySelectorAll('.app-window[data-window="prompts"]'));
    const header = firstWindow.querySelector('.window-header');
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    firstWindow.getBoundingClientRect = () => ({
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    });

    dispatchPointer(window, header, 'pointerdown', { clientX: 260, clientY: 230, pointerId: 10 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 1199, clientY: 400, pointerId: 10 });
    expect(area.querySelector('.window-snap-preview')?.dataset.snapTarget).toBe('right');
    dispatchPointer(window, window.document, 'pointerup', { clientX: 1199, clientY: 400, pointerId: 10 });

    expect(firstWindow.dataset.snapTarget).toBe('right');
    expect(firstWindow.style.left).toBe('600px');
    expect(firstWindow.style.top).toBe('0px');
    expect(firstWindow.style.width).toBe('600px');
    expect(firstWindow.style.height).toBe('900px');
    const assist = area.querySelector('.window-snap-assist');
    expect(assist).not.toBeNull();
    expect(assist.querySelector('.window-snap-assist-slot')?.dataset.snapTarget).toBe('left');
    expect(assist.querySelectorAll('.window-snap-assist-window')).toHaveLength(1);
  });

  test('dragging the divider between snapped halves resizes both windows together', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const [rightWindow, leftWindow] = Array.from(
      window.document.querySelectorAll('.app-window[data-window="prompts"]')
    );
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    rightWindow.getBoundingClientRect = () => ({
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    });

    dispatchPointer(window, rightWindow.querySelector('.window-header'), 'pointerdown', {
      clientX: 260,
      clientY: 230,
      pointerId: 20
    });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 1200, clientY: 400, pointerId: 20 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 1200, clientY: 400, pointerId: 20 });
    area.querySelector('.window-snap-assist-window')?.click();

    const divider = area.querySelector('.window-snap-divider[data-divider="vertical"]');
    expect(leftWindow.dataset.snapTarget).toBe('left');
    expect(divider).not.toBeNull();
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    dispatchPointer(window, divider, 'pointerdown', { clientX: 600, clientY: 400, pointerId: 21 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 720, clientY: 400, pointerId: 21 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 720, clientY: 400, pointerId: 21 });

    expect(leftWindow.style.left).toBe('0px');
    expect(leftWindow.style.width).toBe('720px');
    expect(rightWindow.style.left).toBe('720px');
    expect(rightWindow.style.width).toBe('480px');
    expect(parseFloat(leftWindow.style.width) + parseFloat(rightWindow.style.width)).toBe(1200);
  });

  test('four-corner layouts expose independent horizontal dividers for each column', () => {
    const { window } = setupDom();
    for (let index = 0; index < 4; index += 1) openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindows = Array.from(
      window.document.querySelectorAll('.app-window[data-window="prompts"]')
    );
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    const floatingRect = {
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    };
    promptWindows.forEach(win => {
      win.getBoundingClientRect = () => floatingRect;
    });
    const releases = [
      { x: 0, y: 42, target: 'top-left' },
      { x: 0, y: 942, target: 'bottom-left' },
      { x: 1200, y: 42, target: 'top-right' },
      { x: 1200, y: 942, target: 'bottom-right' }
    ];
    promptWindows.forEach((win, index) => {
      const pointerId = 30 + index;
      dispatchPointer(window, win.querySelector('.window-header'), 'pointerdown', {
        clientX: 260,
        clientY: 230,
        pointerId
      });
      dispatchPointer(window, window.document, 'pointermove', {
        clientX: releases[index].x,
        clientY: releases[index].y,
        pointerId
      });
      dispatchPointer(window, window.document, 'pointerup', {
        clientX: releases[index].x,
        clientY: releases[index].y,
        pointerId
      });
      expect(win.dataset.snapTarget).toBe(releases[index].target);
    });

    const leftDivider = area.querySelector(
      '.window-snap-divider[data-divider="horizontal-left"]'
    );
    const rightDivider = area.querySelector(
      '.window-snap-divider[data-divider="horizontal-right"]'
    );
    expect(leftDivider).not.toBeNull();
    expect(rightDivider).not.toBeNull();
    dispatchPointer(window, leftDivider, 'pointerdown', { clientX: 300, clientY: 492, pointerId: 35 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 300, clientY: 582, pointerId: 35 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 300, clientY: 582, pointerId: 35 });

    expect(promptWindows[0].style.height).toBe('540px');
    expect(promptWindows[1].style.top).toBe('540px');
    expect(promptWindows[1].style.height).toBe('360px');
    expect(promptWindows[2].style.height).toBe('450px');
    expect(promptWindows[3].style.top).toBe('450px');
  });

  test('top-edge release maximizes and the title-bar control restores the floating rectangle', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const header = promptWindow.querySelector('.window-header');
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    promptWindow.getBoundingClientRect = () => ({
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    });

    dispatchPointer(window, header, 'pointerdown', { clientX: 260, clientY: 230, pointerId: 14 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 600, clientY: 42, pointerId: 14 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 600, clientY: 42, pointerId: 14 });
    expect(promptWindow.classList.contains('is-maximized')).toBe(true);

    // A normal title-bar click is focus, not a drag-to-restore gesture.
    dispatchPointer(window, header, 'pointerdown', { clientX: 600, clientY: 60, pointerId: 15 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 600, clientY: 60, pointerId: 15 });
    expect(promptWindow.classList.contains('is-maximized')).toBe(true);

    promptWindow.querySelector('.maximize-toggle').click();
    expect(promptWindow.classList.contains('is-maximized')).toBe(false);
    expect(promptWindow.style.left).toBe('220px');
    expect(promptWindow.style.top).toBe('158px');
    expect(promptWindow.style.width).toBe('640px');
    expect(promptWindow.style.height).toBe('420px');
  });

  test('corner Snap Assist can place another window into a chosen quarter', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindows = Array.from(window.document.querySelectorAll('.app-window[data-window="prompts"]'));
    const [firstWindow, secondWindow] = promptWindows;
    const header = secondWindow.querySelector('.window-header');
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    secondWindow.getBoundingClientRect = () => ({
      left: 260,
      top: 230,
      width: 640,
      height: 420,
      right: 900,
      bottom: 650
    });

    dispatchPointer(window, header, 'pointerdown', { clientX: 300, clientY: 250, pointerId: 11 });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 0, clientY: 42, pointerId: 11 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 0, clientY: 42, pointerId: 11 });

    expect(secondWindow.dataset.snapTarget).toBe('top-left');
    const targetSlot = area.querySelector('.window-snap-assist-slot[data-snap-target="top-right"]');
    const candidate = targetSlot?.querySelector('.window-snap-assist-window');
    expect(area.querySelectorAll('.window-snap-assist-slot')).toHaveLength(3);
    expect(candidate?.dataset.instance).toBe(firstWindow.dataset.instance);
    candidate.click();

    expect(firstWindow.dataset.snapTarget).toBe('top-right');
    expect(firstWindow.style.left).toBe('600px');
    expect(firstWindow.style.top).toBe('0px');
    expect(firstWindow.style.width).toBe('600px');
    expect(firstWindow.style.height).toBe('450px');
    expect(area.querySelector('.window-snap-assist')).toBeNull();
  });

  test('joining an existing snapped layout suppresses the redundant Snap Assist chooser', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const [firstWindow, secondWindow] = Array.from(
      window.document.querySelectorAll('.app-window[data-window="prompts"]')
    );
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 942
    });
    const floatingRect = {
      left: 220,
      top: 200,
      width: 640,
      height: 420,
      right: 860,
      bottom: 620
    };
    firstWindow.getBoundingClientRect = () => floatingRect;
    secondWindow.getBoundingClientRect = () => floatingRect;

    dispatchPointer(window, firstWindow.querySelector('.window-header'), 'pointerdown', {
      clientX: 260,
      clientY: 230,
      pointerId: 12
    });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 0, clientY: 400, pointerId: 12 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 0, clientY: 400, pointerId: 12 });
    expect(firstWindow.dataset.snapTarget).toBe('left');

    dispatchPointer(window, secondWindow.querySelector('.window-header'), 'pointerdown', {
      clientX: 260,
      clientY: 230,
      pointerId: 13
    });
    dispatchPointer(window, window.document, 'pointermove', { clientX: 1200, clientY: 42, pointerId: 13 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 1200, clientY: 42, pointerId: 13 });

    expect(secondWindow.dataset.snapTarget).toBe('top-right');
    expect(area.querySelector('.window-snap-assist')).toBeNull();
    expect(area.querySelector('.window-snap-divider[data-divider="vertical"]')).not.toBeNull();
  });

  test('browser resize re-fits floating windows so their full frame stays reachable', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const area = window.document.getElementById('window-area');
    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    let areaWidth = 1200;
    let areaHeight = 900;
    area.getBoundingClientRect = () => ({
      left: 0,
      top: 42,
      width: areaWidth,
      height: areaHeight,
      right: areaWidth,
      bottom: 42 + areaHeight
    });
    promptWindow.style.left = '500px';
    promptWindow.style.top = '400px';
    promptWindow.style.width = '640px';
    promptWindow.style.height = '420px';
    promptWindow.getBoundingClientRect = () => {
      const left = parseFloat(promptWindow.style.left) || 0;
      const top = 42 + (parseFloat(promptWindow.style.top) || 0);
      const width = parseFloat(promptWindow.style.width) || 640;
      const height = parseFloat(promptWindow.style.height) || 420;
      return { left, top, width, height, right: left + width, bottom: top + height };
    };
    areaWidth = 800;
    areaHeight = 600;

    window.dispatchEvent(new window.Event('resize'));

    expect(promptWindow.style.left).toBe('160px');
    expect(promptWindow.style.top).toBe('180px');
    expect(promptWindow.style.width).toBe('640px');
    expect(promptWindow.style.height).toBe('420px');
  });

  test('multiple prompt windows generate independently from each window root', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');
    openWindow(window, 'prompts');

    const promptWindows = Array.from(window.document.querySelectorAll('.app-window[data-window="prompts"]'));
    expect(promptWindows.length).toBe(2);
    expect(window.document.querySelectorAll('.taskbar-button').length).toBe(2);

    const firstRoot = promptWindows[0].querySelector('.mix-root');
    const secondRoot = promptWindows[1].querySelector('.mix-root');
    window.PromptMixer.applyMixState({
      mixes: [
        {
          type: 'mix',
          preserve: true,
          orderMode: 'canonical',
          lengthMode: 'fit-smallest',
          children: [
            { type: 'chunk', text: 'alpha ', orderMode: 'canonical', lengthMode: 'exact-once' }
          ]
        }
      ]
    }, firstRoot);
    window.PromptMixer.applyMixState({
      mixes: [
        {
          type: 'mix',
          preserve: true,
          orderMode: 'canonical',
          lengthMode: 'fit-smallest',
          children: [
            { type: 'chunk', text: 'beta ', orderMode: 'canonical', lengthMode: 'exact-once' }
          ]
        }
      ]
    }, secondRoot);

    const firstGenerate = promptWindows[0].querySelector('.generate-button');
    const secondGenerate = promptWindows[1].querySelector('.generate-button');
    firstGenerate.click();
    secondGenerate.click();

    const firstOutput = promptWindows[0].querySelector('.mix-output-text')?.textContent || '';
    const secondOutput = promptWindows[1].querySelector('.mix-output-text')?.textContent || '';
    expect(firstOutput).toBe('alpha ');
    expect(secondOutput).toBe('beta ');
  });

  test('persisted local storage is ignored when opening a fresh prompt window', () => {
    const { window } = setupDom({
      persistedState: {
        mixes: [
          {
            type: 'mix',
            title: 'Persisted Window',
            preserve: true,
            lengthMode: 'fit-smallest',
            orderMode: 'canonical',
            children: [
              { type: 'chunk', text: 'persisted ', lengthMode: 'exact-once', orderMode: 'canonical' }
            ]
          }
        ]
      }
    });
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const root = promptWindow.querySelector('.mix-root');
    promptWindow.querySelector('.generate-button').click();

    expect(root.querySelectorAll('.mix-box')).toHaveLength(1);
    expect(root.querySelector('.mix-box .box-title')?.value).not.toBe('Persisted Window');
    expect(promptWindow.querySelector('.mix-output-text')?.textContent || '').toBe('');
  });

  test('beforeunload does not save prompt state to local storage', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const root = promptWindow?.querySelector('.mix-root');
    window.PromptMixer.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Runtime Window',
          preserve: true,
          lengthMode: 'fit-smallest',
          orderMode: 'canonical',
          children: [
            { type: 'chunk', title: 'Runtime String', text: 'runtime ', lengthMode: 'exact-once', orderMode: 'canonical' }
          ]
        }
      ]
    }, root);

    window.dispatchEvent(new window.Event('beforeunload'));
    expect(window.localStorage.getItem('promptEnhancerMixData')).toBeNull();
  });

  test('File Open explicitly replaces the fresh prompt state', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const loadInput = promptWindow.querySelector('.load-mix-file');
    const openItem = promptWindow.querySelector('.prompt-menu-item[data-action="open"]');
    const previousFileReader = window.FileReader;
    window.FileReader = class {
      readAsText(file) {
        this.result = file?.content || '';
        if (typeof this.onload === 'function') this.onload();
      }
    };
    Object.defineProperty(loadInput, 'files', {
      value: [
        {
          name: 'manual-load.json',
          content: JSON.stringify({
            mixes: [
              {
                type: 'mix',
                title: 'Manual Load',
                preserve: true,
                lengthMode: 'fit-smallest',
                orderMode: 'canonical',
                children: [
                  { type: 'chunk', text: 'manual ', lengthMode: 'exact-once', orderMode: 'canonical' }
                ]
              }
            ]
          })
        }
      ],
      configurable: true
    });

    openItem.click();
    loadInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    promptWindow.querySelector('.generate-button').click();

    expect(promptWindow.querySelector('.window-header .box-title')?.textContent).toBe('manual-load');
    expect(promptWindow.querySelector('.mix-output-text')?.textContent || '').toBe('manual ');
    window.FileReader = previousFileReader;
  });

  test('root add buttons create new mix and string boxes', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const root = promptWindow?.querySelector('.mix-root');
    const addMixButton = promptWindow?.querySelector('.add-root-mix');
    const addStringButton = promptWindow?.querySelector('.add-root-chunk');
    expect(root).not.toBeNull();
    expect(addMixButton).not.toBeNull();
    expect(addStringButton).not.toBeNull();

    const initialMixCount = root.querySelectorAll('.mix-box').length;
    const initialChunkCount = root.querySelectorAll('.chunk-box').length;

    addMixButton.click();
    addStringButton.click();

    const mixBoxes = Array.from(root.querySelectorAll('.mix-box'));
    const chunkBoxes = Array.from(root.querySelectorAll('.chunk-box'));
    expect(mixBoxes.length).toBe(initialMixCount + 1);
    expect(chunkBoxes.length).toBe(initialChunkCount + 1);

    const newMixTitle = mixBoxes[mixBoxes.length - 1]?.querySelector('.box-title')?.value || '';
    const newChunkTitle = chunkBoxes[chunkBoxes.length - 1]?.querySelector('.box-title')?.value || '';
    const wordCount = value => String(value).trim().split(/\s+/).filter(Boolean).length;
    expect(newMixTitle.trim()).not.toMatch(/^mix$/i);
    expect(newChunkTitle.trim()).not.toMatch(/^string$/i);
    expect(wordCount(newMixTitle)).toBeLessThanOrEqual(3);
    expect(wordCount(newChunkTitle)).toBeLessThanOrEqual(3);
  });

  test('procedural naming uses only name pool with type prefixes', () => {
    const { window } = setupDom();
    openWindow(window, 'prompts');

    const promptWindow = window.document.querySelector('.app-window[data-window="prompts"]');
    const root = promptWindow?.querySelector('.mix-root');
    const addMixButton = promptWindow?.querySelector('.add-root-mix');
    const addStringButton = promptWindow?.querySelector('.add-root-chunk');
    expect(root).not.toBeNull();
    expect(addMixButton).not.toBeNull();
    expect(addStringButton).not.toBeNull();

    for (let i = 0; i < 28; i += 1) {
      addMixButton.click();
      addStringButton.click();
    }

    const allowedNames = new Set([
      'diskrot',
      'sirbitesalot',
      'yolkhead',
      'alex ayers',
      'mikey schulman',
      'kakermix',
      'allison',
      'ari',
      'io',
      'p8ntmstrg',
      'misscalamity',
      'subcreation',
      'taboovector',
      'tigonn',
      'vocondus',
      'christian',
      'andre andre',
      'falcon',
      'furry',
      'gtzy',
      'lucid',
      'neffy',
      'oakwood',
      'offchune',
      'wellaways',
      'xranoxxd',
      'jonathan fly',
      'greyplains',
      'bela'
    ]);
    const disallowedGeography = /\b(haifa|kishon|carmel|akko|galilee|jezreel|debrecen|cement|shipyard|foundry|terminals|workshops)\b/i;

    const mixTitles = Array.from(root.querySelectorAll('.mix-box .box-title'))
      .map(titleEl => (titleEl?.value || titleEl?.textContent || '').trim())
      .filter(Boolean)
      .slice(1);
    const chunkTitles = Array.from(root.querySelectorAll('.chunk-box .box-title'))
      .map(titleEl => (titleEl?.value || titleEl?.textContent || '').trim())
      .filter(Boolean)
      .slice(1);
    expect(mixTitles.length).toBeGreaterThan(10);
    expect(chunkTitles.length).toBeGreaterThan(10);

    mixTitles.forEach(title => {
      expect(title.toLowerCase().startsWith('mix ')).toBe(true);
      const name = title.slice(4).trim().toLowerCase();
      expect(allowedNames.has(name)).toBe(true);
      expect(disallowedGeography.test(title)).toBe(false);
    });
    chunkTitles.forEach(title => {
      expect(title.toLowerCase().startsWith('string ')).toBe(true);
      const name = title.slice(7).trim().toLowerCase();
      expect(allowedNames.has(name)).toBe(true);
      expect(disallowedGeography.test(title)).toBe(false);
    });
  });

  test('procedural naming sequence changes across fresh reloads', () => {
    const first = sampleProceduralTitles(18);
    const second = sampleProceduralTitles(18);
    const sameMix =
      first.mixTitles.length === second.mixTitles.length &&
      first.mixTitles.every((value, index) => value === second.mixTitles[index]);
    const sameChunk =
      first.chunkTitles.length === second.chunkTitles.length &&
      first.chunkTitles.every((value, index) => value === second.chunkTitles[index]);
    expect(sameMix && sameChunk).toBe(false);
  });
});

describe('Window edge layout policy', () => {
  test('pure geometry helpers distinguish halves, corners, top maximize, and no-op bottom center', () => {
    const { window } = setupDom();
    const bounds = { left: 0, top: 42, right: 1200, bottom: 942, width: 1200, height: 900 };
    const targetCases = [
      [0, 42, 'top-left'],
      [1200, 42, 'top-right'],
      [0, 942, 'bottom-left'],
      [1200, 942, 'bottom-right'],
      [0, 400, 'left'],
      [1200, 400, 'right'],
      [600, 42, 'maximize'],
      [600, 942, '']
    ];
    targetCases.forEach(([x, y, expected]) => {
      expect(window.PromptMixer.getWindowSnapTarget(x, y, bounds)).toBe(expected);
    });

    expect(window.PromptMixer.getWindowSnapBounds('bottom-right', 1200, 900)).toEqual({
      left: 600,
      top: 450,
      width: 600,
      height: 450
    });
    expect(window.PromptMixer.getWindowSnapBounds('bottom-right', 1200, 900, {
      verticalRatio: 0.6,
      leftHorizontalRatio: 0.5,
      rightHorizontalRatio: 0.4
    })).toEqual({ left: 720, top: 360, width: 480, height: 540 });
    expect(window.PromptMixer.resizeWindowGeometry(
      { left: 220, top: 158, width: 640, height: 420 },
      'nw',
      -120,
      -80,
      1200,
      900
    )).toEqual({ left: 100, top: 78, width: 760, height: 500 });
    expect(window.PromptMixer.clampWindowGeometry(
      { left: 900, top: 800, width: 640, height: 420 },
      1200,
      900
    )).toEqual({ left: 560, top: 480, width: 640, height: 420 });
  });

  test('window area starts directly under taskbar with no extra top gap', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/#desktop[\s\S]*?padding-top:\s*var\(--taskbar-height\);/);
    expect(css).toMatch(/#window-area[\s\S]*?min-height:\s*calc\(100vh - var\(--taskbar-height\)\);/);
    expect(css).not.toMatch(/padding-top:\s*calc\(var\(--taskbar-height\) \+ var\(--taskbar-padding\)\);/);
    expect(css).not.toMatch(/min-height:\s*calc\(100vh - var\(--taskbar-height\) - var\(--taskbar-padding\)\);/);
  });

  test('prompt workspace meets the file menu without an inherited flex gap', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/\.prompt-window\s*>\s*\.box-body\s*\{[^}]*gap:\s*0;/);
  });

  test('floating windows can fill the desktop and their flex body fills tall resizes', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/#window-area\s*\{[^}]*height:\s*calc\(100dvh - var\(--taskbar-height\)\);[^}]*overflow:\s*hidden;/);
    expect(css).toMatch(/\.app-window\s*\{[^}]*max-width:\s*none;[^}]*max-height:\s*none;/);
    expect(css).toMatch(/\.app-window\s*>\s*\.box-body\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*auto;/);
    expect(css).not.toMatch(/\.app-window\s*\{[^}]*max-width:\s*95vw;/);
    expect(css).not.toMatch(/(^|\n)body\s*\{[^}]*scrollbar-gutter:\s*stable;/);
  });

  test('snap preview and assist remain desktop overlays instead of new page scroll regions', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/\.window-snap-preview\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/);
    expect(css).toMatch(/\.window-snap-assist\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/);
    expect(css).toMatch(/\.window-snap-assist-options\s*\{[^}]*overflow-y:\s*auto;/);
    expect(css).toMatch(/\.window-snap-dividers\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/);
    expect(css).toMatch(/\.window-snap-divider\[data-divider="vertical"\]\s*\{[^}]*cursor:\s*ew-resize;/);
    expect(css).toMatch(/\.window-snap-divider\[data-divider\^="horizontal-"\]\s*\{[^}]*cursor:\s*ns-resize;/);
  });

  test('floating resize hit zones cover all four borders and corners', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/\.resize-n,\s*\n\.resize-s\s*\{[^}]*cursor:\s*ns-resize;/);
    expect(css).toMatch(/\.resize-e,\s*\n\.resize-w\s*\{[^}]*cursor:\s*ew-resize;/);
    expect(css).toMatch(/\.resize-nw\s*\{[^}]*cursor:\s*nwse-resize;/);
    expect(css).toMatch(/\.resize-sw\s*\{[^}]*cursor:\s*nesw-resize;/);
  });

  test('start mark corrects the slash baseline independently from the yolk label', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/\.menu-glyph \.slash\s*\{[^}]*translateY\(-4px\) scaleY\(1\.1\)/);
    expect(css).toMatch(/\.menu-glyph-tag\s*\{[^}]*translateY\(1px\)/);
    expect(css).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.menu-glyph \.slash\s*\{[^}]*translateY\(-2px\) scaleY\(1\.1\)/);
    expect(css).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.menu-glyph-tag\s*\{[^}]*translateY\(0\)/);
  });

  test('mobile keeps desktop file chrome and margin-free taskbar alignment', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    const mobileCss = css.match(/@media \(max-width: 480px\)\s*\{[\s\S]*$/)?.[0] || '';
    expect(mobileCss).not.toMatch(/(^|\n)\s*button\s*\{[^}]*margin-bottom:/);
    expect(mobileCss).not.toMatch(/\.prompt-menu-start(?::|\s|\{)/);
    expect(css).toMatch(/\.prompt-menu-start\s*\{[^}]*height:\s*100%;[^}]*background:\s*transparent;[^}]*border:\s*none;/);
  });
});

registerDomCleanup();
