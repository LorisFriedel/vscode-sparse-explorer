import { ExpandStore } from '../ExpandStore';

describe('ExpandStore', () => {
  let store: ExpandStore;

  beforeEach(() => {
    store = new ExpandStore();
  });

  describe('initial state', () => {
    test('nothing is expanded', () => {
      expect(store.isExpanded('/some/dir')).toBe(false);
      expect(store.hasAnyExpanded()).toBe(false);
    });

    test('no filters exist', () => {
      expect(store.hasFilter('/some/dir')).toBe(false);
      expect(store.getFilter('/some/dir')).toBeUndefined();
    });
  });

  describe('expand / collapse', () => {
    test('expand marks a dir as expanded', () => {
      store.expand('/root/src');
      expect(store.isExpanded('/root/src')).toBe(true);
      expect(store.hasAnyExpanded()).toBe(true);
    });

    test('other dirs are unaffected by an expand', () => {
      store.expand('/root/src');
      expect(store.isExpanded('/root/lib')).toBe(false);
    });

    test('collapse removes expansion', () => {
      store.expand('/root/src');
      store.collapse('/root/src');
      expect(store.isExpanded('/root/src')).toBe(false);
      expect(store.hasAnyExpanded()).toBe(false);
    });

    test('collapse also clears any filter on that dir', () => {
      store.expand('/root/src');
      store.setFilter('/root/src', 'test');
      store.collapse('/root/src');
      expect(store.hasFilter('/root/src')).toBe(false);
      expect(store.getFilter('/root/src')).toBeUndefined();
    });

    test('collapsing a dir that was never expanded is a no-op', () => {
      expect(() => store.collapse('/root/src')).not.toThrow();
      expect(store.hasAnyExpanded()).toBe(false);
    });
  });

  describe('collapseAll', () => {
    test('clears all expanded dirs', () => {
      store.expand('/root/src');
      store.expand('/root/lib');
      store.collapseAll();
      expect(store.isExpanded('/root/src')).toBe(false);
      expect(store.isExpanded('/root/lib')).toBe(false);
      expect(store.hasAnyExpanded()).toBe(false);
    });

    test('clears all filters', () => {
      store.expand('/root/src');
      store.setFilter('/root/src', 'test');
      store.collapseAll();
      expect(store.hasFilter('/root/src')).toBe(false);
    });
  });

  describe('filters', () => {
    test('setFilter / getFilter round-trip', () => {
      store.setFilter('/root/src', 'component');
      expect(store.getFilter('/root/src')).toBe('component');
      expect(store.hasFilter('/root/src')).toBe(true);
    });

    test('clearFilter removes the filter but not the expansion', () => {
      store.expand('/root/src');
      store.setFilter('/root/src', 'test');
      store.clearFilter('/root/src');
      expect(store.hasFilter('/root/src')).toBe(false);
      expect(store.getFilter('/root/src')).toBeUndefined();
      expect(store.isExpanded('/root/src')).toBe(true);
    });

    test('filter can be set independently per directory', () => {
      store.setFilter('/root/src', 'alpha');
      store.setFilter('/root/lib', 'beta');
      expect(store.getFilter('/root/src')).toBe('alpha');
      expect(store.getFilter('/root/lib')).toBe('beta');
    });
  });
});
