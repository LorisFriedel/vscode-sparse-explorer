import { buildExcludeMatcher, globToRegExp } from '../utils/excludeUtils';

describe('globToRegExp', () => {
  test('**/ matches at any depth including the root', () => {
    const re = globToRegExp('**/.DS_Store');
    expect(re.test('.DS_Store')).toBe(true);
    expect(re.test('src/.DS_Store')).toBe(true);
    expect(re.test('a/b/c/.DS_Store')).toBe(true);
    expect(re.test('.DS_Store_backup')).toBe(false);
    expect(re.test('notes.DS_Store')).toBe(false);
  });

  test('a literal name does not match a longer sibling with the same prefix', () => {
    const re = globToRegExp('**/.git');
    expect(re.test('.git')).toBe(true);
    expect(re.test('src/.git')).toBe(true);
    // .github / .gitignore must stay visible
    expect(re.test('.github')).toBe(false);
    expect(re.test('.gitignore')).toBe(false);
  });

  test('* stays within a single path segment', () => {
    const re = globToRegExp('**/*.pyc');
    expect(re.test('foo.pyc')).toBe(true);
    expect(re.test('pkg/foo.pyc')).toBe(true);
    expect(re.test('foo.pyc.bak')).toBe(false);
  });

  test('? matches exactly one non-separator char', () => {
    const re = globToRegExp('foo?.txt');
    expect(re.test('foo1.txt')).toBe(true);
    expect(re.test('foo.txt')).toBe(false);
    expect(re.test('fooXY.txt')).toBe(false);
  });

  test('{a,b} alternation', () => {
    const re = globToRegExp('**/*.{js,ts}');
    expect(re.test('a.js')).toBe(true);
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('a.jsx')).toBe(false);
  });

  test('regex metacharacters in the glob are treated literally', () => {
    const re = globToRegExp('**/build (old)');
    expect(re.test('build (old)')).toBe(true);
    expect(re.test('nested/build (old)')).toBe(true);
    expect(re.test('buildXold')).toBe(false);
  });
});

describe('buildExcludeMatcher', () => {
  // VS Code's default files.exclude.
  const DEFAULTS: Record<string, unknown> = {
    '**/.git': true,
    '**/.svn': true,
    '**/.hg': true,
    '**/CVS': true,
    '**/.DS_Store': true,
    '**/Thumbs.db': true,
  };

  test('hides the default set at any depth', () => {
    const isExcluded = buildExcludeMatcher(DEFAULTS);
    expect(isExcluded('.DS_Store')).toBe(true);
    expect(isExcluded('.git')).toBe(true);
    expect(isExcluded('deep/nested/.DS_Store')).toBe(true);
    expect(isExcluded('CVS')).toBe(true);
  });

  test('keeps ordinary and dot-config files visible', () => {
    const isExcluded = buildExcludeMatcher(DEFAULTS);
    expect(isExcluded('app.ts')).toBe(false);
    expect(isExcluded('.env')).toBe(false);
    expect(isExcluded('.gitignore')).toBe(false);
    expect(isExcluded('.github')).toBe(false);
    expect(isExcluded('src/index.ts')).toBe(false);
  });

  test('ignores patterns that are not exactly true (false / conditional objects)', () => {
    const isExcluded = buildExcludeMatcher({
      '**/.DS_Store': false,
      '**/*.js': { when: '$(basename).ts' },
    });
    expect(isExcluded('.DS_Store')).toBe(false);
    expect(isExcluded('a.js')).toBe(false);
  });

  test('empty / undefined config never excludes', () => {
    expect(buildExcludeMatcher({})('anything')).toBe(false);
    expect(buildExcludeMatcher(undefined)('anything')).toBe(false);
  });

  test('honours a custom user pattern', () => {
    const isExcluded = buildExcludeMatcher({ '**/node_modules': true });
    expect(isExcluded('node_modules')).toBe(true);
    expect(isExcluded('packages/app/node_modules')).toBe(true);
    expect(isExcluded('node_modules_backup')).toBe(false);
  });
});
