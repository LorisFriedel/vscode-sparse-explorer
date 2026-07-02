import * as path from 'path';
import * as vscode from 'vscode';

const STORAGE_KEY = 'sparseExplorer.admitted';

export class AdmittedStore {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private _admittedPaths: Set<string>;

  constructor(private readonly _context: vscode.ExtensionContext) {
    const stored = _context.workspaceState.get<string[]>(STORAGE_KEY, []);
    this._admittedPaths = new Set(stored);
  }

  get paths(): Set<string> {
    return this._admittedPaths;
  }

  has(fsPath: string): boolean {
    return this._admittedPaths.has(fsPath);
  }

  admit(fsPath: string): void {
    if (this._admittedPaths.has(fsPath)) return;
    this._admittedPaths.add(fsPath);
    this._persist();
    this._onDidChange.fire();
  }

  admitAll(fsPaths: string[]): void {
    const before = this._admittedPaths.size;
    for (const p of fsPaths) this._admittedPaths.add(p);
    if (this._admittedPaths.size !== before) {
      this._persist();
      this._onDidChange.fire();
    }
  }

  eject(fsPath: string): void {
    if (!this._admittedPaths.delete(fsPath)) return;
    this._persist();
    this._onDidChange.fire();
  }

  /** Removes fsPath and any admitted path nested under it (for deleting a directory). */
  ejectPrefix(fsPath: string): void {
    const prefix = fsPath + path.sep;
    const before = this._admittedPaths.size;
    for (const p of this._admittedPaths) {
      if (p === fsPath || p.startsWith(prefix)) this._admittedPaths.delete(p);
    }
    if (this._admittedPaths.size === before) return;
    this._persist();
    this._onDidChange.fire();
  }

  /** Rewrites oldPath (and any admitted path nested under it) to sit under newPath, for renames. */
  renamePrefix(oldPath: string, newPath: string): void {
    const prefix = oldPath + path.sep;
    let changed = false;
    for (const p of [...this._admittedPaths]) {
      if (p === oldPath) {
        this._admittedPaths.delete(p);
        this._admittedPaths.add(newPath);
        changed = true;
      } else if (p.startsWith(prefix)) {
        this._admittedPaths.delete(p);
        this._admittedPaths.add(newPath + p.slice(oldPath.length));
        changed = true;
      }
    }
    if (!changed) return;
    this._persist();
    this._onDidChange.fire();
  }

  private _persist(): void {
    void this._context.workspaceState.update(STORAGE_KEY, [...this._admittedPaths]);
  }
}
