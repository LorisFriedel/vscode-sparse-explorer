import * as path from 'path';
import * as vscode from 'vscode';

const STORAGE_KEY = 'sparseExplorer.admittedFolders';

/**
 * Persisted set of folders the user has explicitly added to the view.
 *
 * Unlike ExpandStore (the session-only "Show All Files" toggle), an entry here
 * survives restarts: the folder is always rendered in expanded mode, showing
 * every file it contains regardless of which tabs are open. It also acts as a
 * visibility anchor — the folder (and its ancestors) appear even when none of
 * its files have ever been opened. Removal is explicit, via "Remove from View".
 */
export class AdmittedFolderStore {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private _folders: Set<string>;

  constructor(private readonly _context: vscode.ExtensionContext) {
    const stored = _context.workspaceState.get<string[]>(STORAGE_KEY, []);
    this._folders = new Set(stored);
  }

  get paths(): Set<string> {
    return this._folders;
  }

  has(fsPath: string): boolean {
    return this._folders.has(fsPath);
  }

  add(fsPath: string): void {
    if (this._folders.has(fsPath)) return;
    this._folders.add(fsPath);
    this._persist();
    this._onDidChange.fire();
  }

  remove(fsPath: string): void {
    if (!this._folders.delete(fsPath)) return;
    this._persist();
    this._onDidChange.fire();
  }

  /** Removes fsPath and any admitted folder nested under it (for deleting a directory). */
  removePrefix(fsPath: string): void {
    const prefix = fsPath + path.sep;
    const before = this._folders.size;
    for (const p of [...this._folders]) {
      if (p === fsPath || p.startsWith(prefix)) this._folders.delete(p);
    }
    if (this._folders.size === before) return;
    this._persist();
    this._onDidChange.fire();
  }

  /** Rewrites oldPath (and any admitted folder nested under it) to sit under newPath, for renames/moves. */
  renamePrefix(oldPath: string, newPath: string): void {
    const prefix = oldPath + path.sep;
    let changed = false;
    for (const p of [...this._folders]) {
      if (p === oldPath) {
        this._folders.delete(p);
        this._folders.add(newPath);
        changed = true;
      } else if (p.startsWith(prefix)) {
        this._folders.delete(p);
        this._folders.add(newPath + p.slice(oldPath.length));
        changed = true;
      }
    }
    if (!changed) return;
    this._persist();
    this._onDidChange.fire();
  }

  private _persist(): void {
    void this._context.workspaceState.update(STORAGE_KEY, [...this._folders]);
  }
}
