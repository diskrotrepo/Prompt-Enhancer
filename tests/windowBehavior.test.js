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

  test('dragging clamps windows to top-left so headers can align flush to taskbar edge', () => {
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
    dispatchPointer(window, window.document, 'pointermove', { clientX: 10, clientY: 10, pointerId: 7 });
    dispatchPointer(window, window.document, 'pointerup', { clientX: 10, clientY: 10, pointerId: 7 });

    expect(promptWindow.style.left).toBe('0px');
    expect(promptWindow.style.top).toBe('0px');
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

  test('procedural naming avoids local-reference dominance', () => {
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

    const titles = Array.from(root.querySelectorAll('.mix-box .box-title, .chunk-box .box-title'))
      .map(titleEl => (titleEl?.value || titleEl?.textContent || '').trim().toLowerCase())
      .filter(Boolean)
      .filter(value => !/^mix$|^string$/i.test(value));
    expect(titles.length).toBeGreaterThan(20);

    const localPattern = /\b(haifa|kishon|carmel|akko|galilee|jezreel|debrecen|cement|shipyard|foundry|terminals|workshops)\b/i;
    const localCount = titles.filter(value => localPattern.test(value)).length;
    const haifaCount = titles.filter(value => /\bhaifa\b/i.test(value)).length;
    expect(localCount / titles.length).toBeLessThanOrEqual(0.32);
    expect(haifaCount / titles.length).toBeLessThanOrEqual(0.08);
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
  test('window area starts directly under taskbar with no extra top gap', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/#desktop[\s\S]*?padding-top:\s*var\(--taskbar-height\);/);
    expect(css).toMatch(/#window-area[\s\S]*?min-height:\s*calc\(100vh - var\(--taskbar-height\)\);/);
    expect(css).not.toMatch(/padding-top:\s*calc\(var\(--taskbar-height\) \+ var\(--taskbar-padding\)\);/);
    expect(css).not.toMatch(/min-height:\s*calc\(100vh - var\(--taskbar-height\) - var\(--taskbar-padding\)\);/);
  });
});

registerDomCleanup();
