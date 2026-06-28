class TreeItem {
  id?: string;
  description?: string;
  contextValue?: string;
  collapsibleState?: number;
  command?: object;

  constructor(public uri: { fsPath: string }) {}
}

class EventEmitter<T> {
  private _listeners: Array<(e: T) => void> = [];

  readonly event = (listener: (e: T) => void): { dispose: () => void } => {
    this._listeners.push(listener);
    return { dispose: () => { this._listeners = this._listeners.filter(l => l !== listener); } };
  };

  fire(data?: T): void {
    for (const l of this._listeners) l(data as T);
  }

  dispose(): void {
    this._listeners = [];
  }
}

const vscode = {
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
  EventEmitter,
  TreeItem,
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  workspace: {
    workspaceFolders: undefined as unknown,
  },
};

module.exports = vscode;
