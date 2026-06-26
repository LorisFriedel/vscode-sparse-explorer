import * as vscode from 'vscode';

export class TabTracker implements vscode.Disposable {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private _tabPaths: Set<string> = new Set();
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._update();
    this._disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        this._update();
        this._onDidChange.fire();
      }),
      this._onDidChange,
    );
  }

  get tabPaths(): Set<string> {
    return this._tabPaths;
  }

  private _update(): void {
    this._tabPaths = new Set(
      vscode.window.tabGroups.all
        .flatMap(g => g.tabs)
        .filter(t => t.input instanceof vscode.TabInputText)
        .map(t => (t.input as vscode.TabInputText).uri.fsPath),
    );
  }

  dispose(): void {
    this._disposables.forEach(d => d.dispose());
  }
}
