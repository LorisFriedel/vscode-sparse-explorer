import * as vscode from 'vscode';

const STORAGE_KEY = 'explorerFilter.pinned';

export class PinStore {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private _pinnedPaths: Set<string>;

  constructor(private readonly _context: vscode.ExtensionContext) {
    const stored = _context.workspaceState.get<string[]>(STORAGE_KEY, []);
    this._pinnedPaths = new Set(stored);
  }

  get pinnedPaths(): Set<string> {
    return this._pinnedPaths;
  }

  has(fsPath: string): boolean {
    return this._pinnedPaths.has(fsPath);
  }

  pin(fsPath: string): void {
    this._pinnedPaths.add(fsPath);
    this._persist();
    this._onDidChange.fire();
  }

  unpin(fsPath: string): void {
    this._pinnedPaths.delete(fsPath);
    this._persist();
    this._onDidChange.fire();
  }

  private _persist(): void {
    void this._context.workspaceState.update(STORAGE_KEY, [...this._pinnedPaths]);
  }
}
