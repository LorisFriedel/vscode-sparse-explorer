import * as vscode from 'vscode';
import { ExpandStore } from './ExpandStore';
import { ExplorerNode, FilteredExplorerProvider } from './FilteredExplorerProvider';
import { PinStore } from './PinStore';
import { TabTracker } from './TabTracker';

export function activate(context: vscode.ExtensionContext): void {
  const tabTracker = new TabTracker();
  const pinStore = new PinStore(context);
  const expandStore = new ExpandStore();
  const provider = new FilteredExplorerProvider(tabTracker, pinStore, expandStore);

  const treeView = vscode.window.createTreeView('sparseExplorer.view', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  tabTracker.onDidChange(() => provider.refresh(), null, context.subscriptions);
  pinStore.onDidChange(() => provider.refresh(), null, context.subscriptions);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
  );

  const cmds: vscode.Disposable[] = [
    vscode.commands.registerCommand('sparseExplorer.refresh', () => {
      provider.refresh();
    }),

    vscode.commands.registerCommand('sparseExplorer.pinItem', (node: ExplorerNode) => {
      pinStore.pin(node.uri.fsPath);
    }),

    vscode.commands.registerCommand('sparseExplorer.unpinItem', (node: ExplorerNode) => {
      pinStore.unpin(node.uri.fsPath);
    }),

    vscode.commands.registerCommand('sparseExplorer.expandAll', (node: ExplorerNode) => {
      expandStore.expand(node.uri.fsPath);
      provider.refresh();
    }),

    vscode.commands.registerCommand('sparseExplorer.collapseToFiltered', (node: ExplorerNode) => {
      expandStore.collapse(node.uri.fsPath);
      provider.refresh();
    }),

    vscode.commands.registerCommand(
      'sparseExplorer.filterExpanded',
      async (node: ExplorerNode) => {
        const current = expandStore.getFilter(node.uri.fsPath);
        const filter = await vscode.window.showInputBox({
          placeHolder: 'Filter files recursively...',
          value: current ?? '',
          prompt: 'Type to filter files within this directory (leave empty to show all)',
        });
        if (filter === undefined) return; // cancelled
        if (filter === '') {
          expandStore.clearFilter(node.uri.fsPath);
        } else {
          expandStore.setFilter(node.uri.fsPath, filter);
        }
        provider.refresh();
      },
    ),

    vscode.commands.registerCommand('sparseExplorer.clearFilter', (node: ExplorerNode) => {
      expandStore.clearFilter(node.uri.fsPath);
      provider.refresh();
    }),

    vscode.commands.registerCommand('sparseExplorer.revealInExplorer', (node: ExplorerNode) => {
      void vscode.commands.executeCommand('revealInExplorer', node.uri);
    }),
  ];

  context.subscriptions.push(treeView, tabTracker, ...cmds);
}

export function deactivate(): void {}
