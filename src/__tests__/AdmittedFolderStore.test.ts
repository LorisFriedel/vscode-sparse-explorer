import * as path from 'path';
import { AdmittedFolderStore } from '../AdmittedFolderStore';

// A fake ExtensionContext whose workspaceState is backed by a shared Map, so a second
// store built from the same context observes what the first one persisted.
function makeContext(initial: string[] = []): any {
  const backing = new Map<string, unknown>();
  if (initial.length > 0) backing.set('sparseExplorer.admittedFolders', initial);
  return {
    workspaceState: {
      get: (key: string, def: unknown) => (backing.has(key) ? backing.get(key) : def),
      update: (key: string, value: unknown) => {
        backing.set(key, value);
        return Promise.resolve();
      },
    },
  };
}

describe('AdmittedFolderStore', () => {
  describe('initial state', () => {
    test('empty by default', () => {
      const store = new AdmittedFolderStore(makeContext());
      expect(store.has('/root/src')).toBe(false);
      expect([...store.paths]).toEqual([]);
    });

    test('hydrates from persisted state', () => {
      const store = new AdmittedFolderStore(makeContext(['/root/src', '/root/lib']));
      expect(store.has('/root/src')).toBe(true);
      expect(store.has('/root/lib')).toBe(true);
    });
  });

  describe('add / remove', () => {
    test('add marks a folder and persists it', () => {
      const ctx = makeContext();
      const store = new AdmittedFolderStore(ctx);
      store.add('/root/src');
      expect(store.has('/root/src')).toBe(true);
      // Persisted: a fresh store from the same context sees it.
      expect(new AdmittedFolderStore(ctx).has('/root/src')).toBe(true);
    });

    test('add fires onDidChange', () => {
      const store = new AdmittedFolderStore(makeContext());
      const listener = jest.fn();
      store.onDidChange(listener);
      store.add('/root/src');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('adding a duplicate is a no-op and does not fire', () => {
      const store = new AdmittedFolderStore(makeContext());
      store.add('/root/src');
      const listener = jest.fn();
      store.onDidChange(listener);
      store.add('/root/src');
      expect(listener).not.toHaveBeenCalled();
    });

    test('remove deletes and fires', () => {
      const store = new AdmittedFolderStore(makeContext(['/root/src']));
      const listener = jest.fn();
      store.onDidChange(listener);
      store.remove('/root/src');
      expect(store.has('/root/src')).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('removing a folder that was never added is a no-op', () => {
      const store = new AdmittedFolderStore(makeContext());
      const listener = jest.fn();
      store.onDidChange(listener);
      store.remove('/root/src');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('removePrefix', () => {
    test('removes the folder and any admitted descendant', () => {
      const store = new AdmittedFolderStore(
        makeContext([
          path.join('/root', 'src'),
          path.join('/root', 'src', 'utils'),
          path.join('/root', 'lib'),
        ]),
      );
      store.removePrefix(path.join('/root', 'src'));
      expect(store.has(path.join('/root', 'src'))).toBe(false);
      expect(store.has(path.join('/root', 'src', 'utils'))).toBe(false);
      expect(store.has(path.join('/root', 'lib'))).toBe(true);
    });

    test('does not remove a sibling with a shared name prefix', () => {
      const store = new AdmittedFolderStore(
        makeContext([path.join('/root', 'src'), path.join('/root', 'src-extra')]),
      );
      store.removePrefix(path.join('/root', 'src'));
      expect(store.has(path.join('/root', 'src'))).toBe(false);
      expect(store.has(path.join('/root', 'src-extra'))).toBe(true);
    });
  });

  describe('renamePrefix', () => {
    test('rewrites the folder and nested admitted folders', () => {
      const store = new AdmittedFolderStore(
        makeContext([path.join('/root', 'src'), path.join('/root', 'src', 'utils')]),
      );
      store.renamePrefix(path.join('/root', 'src'), path.join('/root', 'app'));
      expect(store.has(path.join('/root', 'app'))).toBe(true);
      expect(store.has(path.join('/root', 'app', 'utils'))).toBe(true);
      expect(store.has(path.join('/root', 'src'))).toBe(false);
    });

    test('leaves unrelated folders untouched', () => {
      const store = new AdmittedFolderStore(
        makeContext([path.join('/root', 'src'), path.join('/root', 'lib')]),
      );
      store.renamePrefix(path.join('/root', 'src'), path.join('/root', 'app'));
      expect(store.has(path.join('/root', 'lib'))).toBe(true);
    });
  });
});
