import * as path from 'path';
import { computeVisiblePaths } from '../utils/pathUtils';

const ROOT = '/workspace';
const j = (...parts: string[]) => path.join(ROOT, ...parts);

describe('computeVisiblePaths', () => {
  test('empty admitted set returns empty visible set', () => {
    expect(computeVisiblePaths(new Set(), [ROOT]).size).toBe(0);
  });

  test('file directly in root adds only the file, not the root itself', () => {
    const file = j('foo.ts');
    const visible = computeVisiblePaths(new Set([file]), [ROOT]);
    expect(visible).toEqual(new Set([file]));
  });

  test('nested file makes all intermediate directories visible', () => {
    const file = j('src', 'utils', 'foo.ts');
    const visible = computeVisiblePaths(new Set([file]), [ROOT]);
    expect(visible).toEqual(new Set([file, j('src', 'utils'), j('src')]));
  });

  test('root itself is never added to visible set', () => {
    const file = j('src', 'foo.ts');
    const visible = computeVisiblePaths(new Set([file]), [ROOT]);
    expect(visible.has(ROOT)).toBe(false);
  });

  test('file not under any workspace root is excluded', () => {
    const file = '/other/foo.ts';
    const visible = computeVisiblePaths(new Set([file]), [ROOT]);
    expect(visible.size).toBe(0);
  });

  test('multiple files produce the union of their ancestor chains', () => {
    const fileA = j('src', 'a.ts');
    const fileB = j('lib', 'b.ts');
    const visible = computeVisiblePaths(new Set([fileA, fileB]), [ROOT]);
    expect(visible).toEqual(new Set([fileA, j('src'), fileB, j('lib')]));
  });

  test('two files sharing an ancestor dir do not duplicate the ancestor', () => {
    const fileA = j('src', 'a.ts');
    const fileB = j('src', 'b.ts');
    const visible = computeVisiblePaths(new Set([fileA, fileB]), [ROOT]);
    expect([...visible].filter(p => p === j('src')).length).toBe(1);
  });

  test('file under second workspace root is visible, not confused with first', () => {
    const root2 = '/workspace2';
    const file = path.join(root2, 'foo.ts');
    const visible = computeVisiblePaths(new Set([file]), [ROOT, root2]);
    expect(visible).toEqual(new Set([file]));
  });

  // Regression: /workspace-other/foo.ts must NOT match root /workspace
  test('path that only shares a string prefix with the root is excluded', () => {
    const file = '/workspace-other/foo.ts';
    const visible = computeVisiblePaths(new Set([file]), [ROOT]);
    expect(visible.size).toBe(0);
  });
});
