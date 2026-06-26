import * as vscode from 'vscode';

export class TabTracker implements vscode.Disposable {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private _onDidOpenTabs = new vscode.EventEmitter<string[]>();
  readonly onDidOpenTabs: vscode.Event<string[]> = this._onDidOpenTabs.event;

  private _tabPaths: Set<string> = new Set();
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._update();
    this._disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(e => {
        this._update();
        this._onDidChange.fire();

        const opened = e.opened
          .filter(t => t.input instanceof vscode.TabInputText)
          .map(t => (t.input as vscode.TabInputText).uri.fsPath);
        if (opened.length > 0) {
          this._onDidOpenTabs.fire(opened);
        }
      }),
      this._onDidChange,
      this._onDidOpenTabs,
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
