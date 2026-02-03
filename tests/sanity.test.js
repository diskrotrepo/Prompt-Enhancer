/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, closeDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const INPUT_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_input.json');
const EXPECTED_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_expected.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Sanity harness: spin up the UI, optionally run scripted actions, then collect visible state.
// Inputs: testCase object from fixtures. Output: snapshot fields for expectations.
function runSanityCase(testCase) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;

  if (window.localStorage) window.localStorage.clear();
  window.alert = () => {};

  // Capture downloads + prompts + clipboard to validate non-output behaviors.
  if (!window.URL) window.URL = {};
  if (typeof window.URL.createObjectURL !== 'function') {
    window.URL.createObjectURL = () => 'blob:mock';
  }
  if (typeof window.URL.revokeObjectURL !== 'function') {
    window.URL.revokeObjectURL = () => {};
  }
  const downloadNames = [];
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const el = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      el.click = () => {
        downloadNames.push(el.download);
      };
    }
    return el;
  };
  const promptResponses = Array.isArray(testCase.promptResponses) ? testCase.promptResponses.slice() : [];
  let promptCount = 0;
  window.prompt = () => {
    promptCount += 1;
    return promptResponses.length ? promptResponses.shift() : '';
  };
  const clipboardState = { last: '' };
  const clipboardShim = {
    writeText: text => {
      clipboardState.last = text;
      return {
        then: cb => {
          cb();
          return { catch: () => {} };
        }
      };
    }
  };
  try {
    window.navigator.clipboard = clipboardShim;
  } catch (err) {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: clipboardShim,
      configurable: true
    });
  }

  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (testCase.persistedState && window.localStorage) {
    const raw =
      typeof testCase.persistedState === 'string'
        ? testCase.persistedState
        : JSON.stringify(testCase.persistedState);
    window.localStorage.setItem('promptEnhancerMixData', raw);
  }
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }

  window.Math.random = () => (typeof testCase.random === 'number' ? testCase.random : 0);

  // Normalize action tokens so fixtures can be short strings or full objects.
  const normalizeAction = action => {
    if (typeof action === 'string') return { type: action };
    if (action && typeof action === 'object') return action;
    return { type: '' };
  };
  const getActiveWindow = () =>
    window.document.querySelector('.app-window:not(.window-template)');
  const getActiveRoot = () => {
    const active = getActiveWindow();
    return active?.querySelector('.mix-root') || window.document.querySelector('.mix-root');
  };
  const runAction = (action, root, actionResults) => {
    const { type } = normalizeAction(action);
    if (type === 'openPromptsWindow') {
      const menuItem = window.document.querySelector('.menu-item[data-window=\"prompts\"]');
      if (menuItem) menuItem.click();
      return;
    }
    if (type === 'menuSave' || type === 'menuSaveAs') {
      const actionKey = type === 'menuSaveAs' ? 'save-as' : 'save';
      const win = getActiveWindow();
      const item =
        win?.querySelector(`.prompt-menu-item[data-action=\"${actionKey}\"]`) ||
        window.document.querySelector(`.prompt-menu-item[data-action=\"${actionKey}\"]`);
      if (item) item.click();
      return;
    }
    if (type === 'copyMixOutput') {
      const btn = root?.querySelector('.mix-box .copy-output');
      if (btn) btn.click();
      actionResults.mixCopiedText = clipboardState.last;
      return;
    }
    if (type === 'copyChunkOutput') {
      const btn = root?.querySelector('.chunk-box .copy-input');
      if (btn) btn.click();
      actionResults.chunkCopiedText = clipboardState.last;
    }
  };

  const actions = Array.isArray(testCase.actions) ? testCase.actions : [];
  const preActions = actions.filter(action => normalizeAction(action).type === 'openPromptsWindow');
  const postActions = actions.filter(action => normalizeAction(action).type !== 'openPromptsWindow');
  preActions.forEach(action => runAction(action));

  const root = getActiveRoot();
  if (!root) throw new Error('Missing mix root');
  if (testCase.state) {
    window.PromptMixer.applyMixState(testCase.state, root);
  }
  window.PromptMixer.generate(root);
  const actionResults = { mixCopiedText: '', chunkCopiedText: '' };
  // Run post-generate actions (copy, menu saves) so outputs are available.
  postActions.forEach(action => runAction(action, root, actionResults));

  const mixBox = root.querySelector('.mix-box') || window.document.querySelector('.mix-box');
  const chunkBox = root.querySelector('.chunk-box') || window.document.querySelector('.chunk-box');
  const output = mixBox?.querySelector('.mix-output-text')?.textContent || '';
  const chunkOutput = chunkBox?.querySelector('.chunk-output-text')?.textContent || '';
  const lengthMode = mixBox?.querySelector('.length-mode')?.value || '';
  const preserve = mixBox?.querySelector('.delimiter-size')?.value === 'preserve';
  const firstChunkSelect = mixBox?.querySelector('.first-chunk-select');
  const firstChunkDisabled = !!(firstChunkSelect?.disabled || firstChunkSelect?.classList.contains('disabled'));
  const lengthLimitDisabled = !!mixBox?.querySelector('.length-input')?.disabled;
  const windowTitle =
    window.document.querySelector('.app-window:not(.window-template) .window-header .box-title')
      ?.textContent ||
    window.document.querySelector('.prompt-window .window-header .box-title')?.textContent ||
    '';
  const variableBox = root.querySelector('.variable-box') || window.document.querySelector('.variable-box');
  const variableTitle = variableBox?.querySelector('.box-title')?.textContent || '';
  const colorMode = mixBox?.dataset?.colorMode || '';
  const colorValue = mixBox?.dataset?.colorValue || '';
  const colorPreset = mixBox?.dataset?.colorPreset || '';
  const chunkColorMode = chunkBox?.dataset?.colorMode || '';
  const chunkColorValue = chunkBox?.dataset?.colorValue || '';
  const chunkColorPreset = chunkBox?.dataset?.colorPreset || '';
  const result = {
    id: testCase.id,
    output,
    chunkOutput,
    lengthMode,
    preserve,
    firstChunkDisabled,
    lengthLimitDisabled,
    windowTitle,
    variableTitle,
    colorMode,
    colorValue,
    colorPreset,
    chunkColorMode,
    chunkColorValue,
    chunkColorPreset,
    mixCopiedText: actionResults.mixCopiedText,
    chunkCopiedText: actionResults.chunkCopiedText,
    promptCount,
    downloadNames
  };
  closeDom(dom);
  return result;
}

describe('Sanity regression via real UI flow', () => {
  test('sanity cases match curated outputs', () => {
    const inputData = readJson(INPUT_PATH);
    const expectedData = readJson(EXPECTED_PATH);
    const expectedMap = new Map(
      (expectedData.cases || []).map(entry => [entry.id, entry])
    );

    (inputData.cases || []).forEach(testCase => {
      const result = runSanityCase(testCase);
      const expected = expectedMap.get(result.id);
      if (!expected) {
        throw new Error(`Missing expected output for sanity case: ${result.id}`);
      }
      expect(result.output).toBe(expected.output);
      if (Object.prototype.hasOwnProperty.call(expected, 'lengthMode')) {
        expect(result.lengthMode).toBe(expected.lengthMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'preserve')) {
        expect(result.preserve).toBe(expected.preserve);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'firstChunkDisabled')) {
        expect(result.firstChunkDisabled).toBe(expected.firstChunkDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'lengthLimitDisabled')) {
        expect(result.lengthLimitDisabled).toBe(expected.lengthLimitDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'windowTitle')) {
        expect(result.windowTitle).toBe(expected.windowTitle);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'variableTitle')) {
        expect(result.variableTitle).toBe(expected.variableTitle);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorMode')) {
        expect(result.colorMode).toBe(expected.colorMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorValue')) {
        expect(result.colorValue).toBe(expected.colorValue);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorPreset')) {
        expect(result.colorPreset).toBe(expected.colorPreset);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkOutput')) {
        expect(result.chunkOutput).toBe(expected.chunkOutput);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'mixCopiedText')) {
        expect(result.mixCopiedText).toBe(expected.mixCopiedText);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkCopiedText')) {
        expect(result.chunkCopiedText).toBe(expected.chunkCopiedText);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'promptCount')) {
        expect(result.promptCount).toBe(expected.promptCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'downloadNames')) {
        expect(result.downloadNames).toEqual(expected.downloadNames);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorMode')) {
        expect(result.chunkColorMode).toBe(expected.chunkColorMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorValue')) {
        expect(result.chunkColorValue).toBe(expected.chunkColorValue);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorPreset')) {
        expect(result.chunkColorPreset).toBe(expected.chunkColorPreset);
      }
    });
  });
});
// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();
