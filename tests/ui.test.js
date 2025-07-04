/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

describe('UI layout rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

  test('button column uses four-grid layout', () => {
    expect(css).toMatch(/\.button-col\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*1\.8rem\)/);
  });

  test('icon buttons have uniform size', () => {
    const rule = /\.button-col\s*\.icon-button\s*{[^}]*}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule[0]).toMatch(/width:\s*1\.8rem/);
    expect(rule[0]).toMatch(/height:\s*1\.8rem/);
  });

  test('button order assigned to grid columns', () => {
    expect(css).toMatch(/\.button-col\s*\.random-button\s*{[^}]*grid-column:\s*1/);
    expect(css).toMatch(/\.button-col\s*\.save-button\s*{[^}]*grid-column:\s*2/);
    expect(css).toMatch(/\.button-col\s*\.copy-button\s*{[^}]*grid-column:\s*3/);
    expect(css).toMatch(/\.button-col\s*\.hide-button\s*{[^}]*grid-column:\s*4/);
  });
});
