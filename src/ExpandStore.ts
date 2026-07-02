import * as path from 'path';

export class ExpandStore {
  private _expandedDirs = new Set<string>();
  private _dirFilters = new Map<string, string>();

  isExpanded(dirPath: string): boolean {
    return this._expandedDirs.has(dirPath);
  }

  expand(dirPath: string): void {
    this._expandedDirs.add(dirPath);
  }

  collapse(dirPath: string): void {
    this._expandedDirs.delete(dirPath);
    this._dirFilters.delete(dirPath);
  }

  setFilter(dirPath: string, filter: string): void {
    this._dirFilters.set(dirPath, filter);
  }

  clearFilter(dirPath: string): void {
    this._dirFilters.delete(dirPath);
  }

  getFilter(dirPath: string): string | undefined {
    return this._dirFilters.get(dirPath);
  }

  hasFilter(dirPath: string): boolean {
    return this._dirFilters.has(dirPath);
  }

  collapseAll(): void {
    this._expandedDirs.clear();
    this._dirFilters.clear();
  }

  hasAnyExpanded(): boolean {
    return this._expandedDirs.size > 0;
  }

  /** Rewrites oldPath (and any expanded/filtered descendant) to sit under newPath, for renames/moves. */
  renamePrefix(oldPath: string, newPath: string): void {
    const prefix = oldPath + path.sep;

    for (const dir of [...this._expandedDirs]) {
      if (dir === oldPath) {
        this._expandedDirs.delete(dir);
        this._expandedDirs.add(newPath);
      } else if (dir.startsWith(prefix)) {
        this._expandedDirs.delete(dir);
        this._expandedDirs.add(newPath + dir.slice(oldPath.length));
      }
    }

    for (const [dir, filter] of [...this._dirFilters]) {
      if (dir === oldPath) {
        this._dirFilters.delete(dir);
        this._dirFilters.set(newPath, filter);
      } else if (dir.startsWith(prefix)) {
        this._dirFilters.delete(dir);
        this._dirFilters.set(newPath + dir.slice(oldPath.length), filter);
      }
    }
  }

  /** Clears expand/filter state for fsPath and any descendant, for deletions. */
  collapsePrefix(fsPath: string): void {
    const prefix = fsPath + path.sep;
    for (const dir of [...this._expandedDirs]) {
      if (dir === fsPath || dir.startsWith(prefix)) this._expandedDirs.delete(dir);
    }
    for (const dir of [...this._dirFilters.keys()]) {
      if (dir === fsPath || dir.startsWith(prefix)) this._dirFilters.delete(dir);
    }
  }
}
