/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const INPUT_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_input.json');
const EXPECTED_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_expected.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runSanityCase(testCase) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;

  if (window.localStorage) window.localStorage.clear();
  window.alert = () => {};

  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }

  window.Math.random = () => (typeof testCase.random === 'number' ? testCase.random : 0);

  const root = window.document.querySelector('.mix-root');
  if (!root) throw new Error('Missing mix root');
  if (testCase.state) {
    window.PromptMixer.applyMixState(testCase.state, root);
  }
  window.PromptMixer.generate(root);

  const mixBox = window.document.querySelector('.mix-box');
  const output = mixBox?.querySelector('.mix-output-text')?.textContent || '';
  const lengthMode = mixBox?.querySelector('.length-mode')?.value || '';
  const preserve = mixBox?.querySelector('.delimiter-size')?.value === 'preserve';
  const randomFirstToggle = mixBox?.querySelector('.random-first-toggle');
  const randomFirstDisabled = !!(randomFirstToggle?.disabled || randomFirstToggle?.classList.contains('disabled'));
  const lengthLimitDisabled = !!mixBox?.querySelector('.length-input')?.disabled;
  const windowTitle = window.document.querySelector('.prompt-window .window-header .box-title')?.textContent || '';
  return {
    id: testCase.id,
    output,
    lengthMode,
    preserve,
    randomFirstDisabled,
    lengthLimitDisabled,
    windowTitle
  };
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
      if (Object.prototype.hasOwnProperty.call(expected, 'randomFirstDisabled')) {
        expect(result.randomFirstDisabled).toBe(expected.randomFirstDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'lengthLimitDisabled')) {
        expect(result.lengthLimitDisabled).toBe(expected.lengthLimitDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'windowTitle')) {
        expect(result.windowTitle).toBe(expected.windowTitle);
      }
    });
  });
});
