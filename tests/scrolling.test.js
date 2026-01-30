const fs = require('fs');
const path = require('path');

describe('scrolling policy', () => {
  const cssPath = path.join(__dirname, '..', 'src', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  test('only window bodies may scroll', () => {
    const autoMatches = css.match(/overflow:\s*auto;/g) || [];
    expect(autoMatches.length).toBe(3);
    expect(css).toMatch(/\.app-window\.is-maximized\s*>\s*\.box-body[\s\S]*?overflow:\s*auto;/);
    expect(css).toMatch(/\.app-window\s*>\s*\.box-body[\s\S]*?overflow:\s*auto;/);
    expect(css).toMatch(/\.prompt-body[\s\S]*?overflow:\s*auto;/);
    expect(css).not.toMatch(/overflow:\s*scroll;/);
    expect(css).toMatch(/\.chunk-input[\s\S]*?overflow:\s*hidden;/);
    expect(css).toMatch(/\.chunk-input[\s\S]*?resize:\s*none;/);
  });

  test('page itself never scrolls', () => {
    const bodyBlock = css.match(/body\s*\{[\s\S]*?\}/);
    const htmlBlock = css.match(/html\s*\{[\s\S]*?\}/);
    expect(bodyBlock?.[0]).toMatch(/overflow:\s*hidden;/);
    expect(htmlBlock?.[0]).toMatch(/overflow:\s*hidden;/);
  });
});
