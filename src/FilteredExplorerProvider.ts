import * as path from 'path';
import * as vscode from 'vscode';
import { ExpandStore } from './ExpandStore';
import { PinStore } from './PinStore';
import { TabTracker } from './TabTracker';
import { hasMatchingDescendant, readDir } from './utils/fsUtils';
import { computeVisiblePaths } from './utils/pathUtils';

export interface ExplorerNode {
  uri: vscode.Uri;
  isDirectory: boolean;
  isWorkspaceRoot: boolean;
  inExpandedContext: boolean;
  propagatedFilter?: string;
}

export class FilteredExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ExplorerNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly tabTracker: TabTracker,
    private readonly pinStore: PinStore,
    private readonly expandStore: ExpandStore,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: ExplorerNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.uri);

    if (node.isDirectory) {
      const isExpanded = this.expandStore.isExpanded(node.uri.fsPath);
      item.collapsibleState = isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

      if (node.isWorkspaceRoot) {
        item.contextValue = 'efDir.workspaceRoot';
      } else if (isExpanded) {
        item.contextValue = this.expandStore.hasFilter(node.uri.fsPath)
          ? 'efDir.expandedFiltered'
          : 'efDir.expanded';
        const filter = this.expandStore.getFilter(node.uri.fsPath);
        if (filter) {
          item.description = `filter: ${filter}`;
        }
      } else if (node.inExpandedContext) {
        item.contextValue = 'efDir.inExpanded';
      } else {
        item.contextValue = 'efDir.filtered';
      }
    } else {
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [node.uri],
      };
      const isPinned = this.pinStore.has(node.uri.fsPath);
      item.contextValue = isPinned ? 'efFile.pinned' : 'efFile.unpinned';
      if (isPinned) {
        item.description = 'pinned';
      }
    }

    return item;
  }

  async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    if (!node) {
      if (workspaceFolders.length === 1) {
        return this._getFilteredChildren(workspaceFolders[0].uri.fsPath);
      }
      return workspaceFolders.map(f => ({
        uri: f.uri,
        isDirectory: true,
        isWorkspaceRoot: true,
        inExpandedContext: false,
      }));
    }

    const dirPath = node.uri.fsPath;

    if (node.inExpandedContext) {
      return this._getExpandedChildren(dirPath, true, node.propagatedFilter);
    }

    if (this.expandStore.isExpanded(dirPath)) {
      const filter = this.expandStore.getFilter(dirPath);
      return this._getExpandedChildren(dirPath, true, filter);
    }

    return this._getFilteredChildren(dirPath);
  }

  private async _getFilteredChildren(dirPath: string): Promise<ExplorerNode[]> {
    const roots = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
    const visible = computeVisiblePaths(
      this.tabTracker.tabPaths,
      this.pinStore.pinnedPaths,
      roots,
    );

    const entries = await readDir(dirPath);
    const nodes: ExplorerNode[] = [];

    for (const entry of entries) {
      if (visible.has(entry.fullPath)) {
        nodes.push({
          uri: vscode.Uri.file(entry.fullPath),
          isDirectory: entry.isDirectory,
          isWorkspaceRoot: false,
          inExpandedContext: false,
        });
      }
    }

    return nodes.sort(compareNodes);
  }

  private async _getExpandedChildren(
    dirPath: string,
    inExpandedContext: boolean,
    filter: string | undefined,
  ): Promise<ExplorerNode[]> {
    const entries = await readDir(dirPath);
    const nodes: ExplorerNode[] = [];

    for (const entry of entries) {
      if (!filter) {
        nodes.push({
          uri: vscode.Uri.file(entry.fullPath),
          isDirectory: entry.isDirectory,
          isWorkspaceRoot: false,
          inExpandedContext,
          propagatedFilter: filter,
        });
      } else {
        const lowerFilter = filter.toLowerCase();
        if (!entry.isDirectory) {
          if (entry.name.toLowerCase().includes(lowerFilter)) {
            nodes.push({
              uri: vscode.Uri.file(entry.fullPath),
              isDirectory: false,
              isWorkspaceRoot: false,
              inExpandedContext,
              propagatedFilter: filter,
            });
          }
        } else {
          if (await hasMatchingDescendant(entry.fullPath, filter)) {
            nodes.push({
              uri: vscode.Uri.file(entry.fullPath),
              isDirectory: true,
              isWorkspaceRoot: false,
              inExpandedContext,
              propagatedFilter: filter,
            });
          }
        }
      }
    }

    return nodes.sort(compareNodes);
  }
}

function compareNodes(a: ExplorerNode, b: ExplorerNode): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1;
  }
  return path.basename(a.uri.fsPath).localeCompare(path.basename(b.uri.fsPath));
}
