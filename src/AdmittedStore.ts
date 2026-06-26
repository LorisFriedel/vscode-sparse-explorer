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

  private _persist(): void {
    void this._context.workspaceState.update(STORAGE_KEY, [...this._admittedPaths]);
  }
}
