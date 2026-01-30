/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const DEFAULT_LIST_PATH = path.join(ROOT, 'src', 'default_list.js');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const INPUT_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_input.json');
const EXPECTED_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_expected.json');
const GENERATED_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_expected.generated.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function applyInputs(window, inputs) {
  const pending = [];
  Object.entries(inputs).forEach(([id, value]) => {
    const el = window.document.getElementById(id);
    if (!el) {
      pending.push([id, value]);
      return;
    }
    if (el.type === 'checkbox') {
      el.checked = !!value;
      el.dispatchEvent(new window.Event('change'));
      return;
    }
    el.value = value == null ? '' : String(value);
    el.dispatchEvent(new window.Event('input'));
    el.dispatchEvent(new window.Event('change'));
  });
  if (!pending.length) return;
  pending.forEach(([id, value]) => {
    const el = window.document.getElementById(id);
    if (!el) {
      throw new Error(`Missing input element: ${id}`);
    }
    if (el.type === 'checkbox') {
      el.checked = !!value;
      el.dispatchEvent(new window.Event('change'));
      return;
    }
    el.value = value == null ? '' : String(value);
    el.dispatchEvent(new window.Event('input'));
    el.dispatchEvent(new window.Event('change'));
  });
}

function runSanityCase(testCase) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;

  if (window.localStorage) window.localStorage.clear();
  window.alert = () => {};

  window.eval(fs.readFileSync(DEFAULT_LIST_PATH, 'utf8'));
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }

  window.Math.random = () => 0;

  applyInputs(window, testCase.inputs);

  const generateBtn = window.document.getElementById('generate');
  if (!generateBtn) throw new Error('Missing generate button');
  generateBtn.click();

  const positive = window.document.getElementById('positive-output')?.textContent || '';
  const negative = window.document.getElementById('negative-output')?.textContent || '';
  const lyrics = window.document.getElementById('lyrics-output')?.textContent || '';
  return { id: testCase.id, positive, negative, lyrics };
}

describe('Sanity regression via real UI flow', () => {
  test('sanity cases match curated outputs', () => {
    const inputData = readJson(INPUT_PATH);
    const expectedData = readJson(EXPECTED_PATH);
    const expectedMap = new Map(
      (expectedData.cases || []).map(entry => [entry.id, entry])
    );

    const generated = { cases: [] };
    (inputData.cases || []).forEach(testCase => {
      const result = runSanityCase(testCase);
      generated.cases.push(result);
    });

    try {
      fs.writeFileSync(GENERATED_PATH, JSON.stringify(generated, null, 2));
    } catch (err) {
      // ignore if we cannot write the artifact
    }

    generated.cases.forEach(result => {
      const expected = expectedMap.get(result.id);
      if (!expected) {
        throw new Error(`Missing expected output for sanity case: ${result.id}`);
      }
      if (typeof expected.positive !== 'undefined') {
        expect(result.positive).toBe(expected.positive);
      }
      if (typeof expected.negative !== 'undefined') {
        expect(result.negative).toBe(expected.negative);
      }
      if (typeof expected.lyrics !== 'undefined') {
        expect(result.lyrics).toBe(expected.lyrics);
      }
    });

    try {
      fs.unlinkSync(GENERATED_PATH);
    } catch (err) {
      // ignore if deletion fails
    }
  });
});
