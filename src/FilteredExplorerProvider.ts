import * as path from 'path';
import * as vscode from 'vscode';
import { AdmittedFolderStore } from './AdmittedFolderStore';
import { AdmittedStore } from './AdmittedStore';
import { ExpandStore } from './ExpandStore';
import { TabTracker } from './TabTracker';
import { buildExcludeMatcher } from './utils/excludeUtils';
import { hasMatchingDescendant, readDir } from './utils/fsUtils';
import { computeVisiblePaths } from './utils/pathUtils';
import { log } from './debugLog';

export interface ExplorerNode {
  uri: vscode.Uri;
  isDirectory: boolean;
  isWorkspaceRoot: boolean;
}

interface Scope {
  expanded: boolean;
  filter: string | undefined;
}

export class FilteredExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ExplorerNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly tabTracker: TabTracker,
    private readonly admittedStore: AdmittedStore,
    private readonly expandStore: ExpandStore,
    private readonly admittedFolderStore: AdmittedFolderStore,
  ) {}

  refresh(): void {
    log('refresh() fired');
    this._onDidChangeTreeData.fire();
  }

  /**
   * Walk from `p` up to (and including) the nearest workspace root, returning the
   * expansion scope governing it: whether some ancestor (or itself) is expanded,
   * and the filter of the nearest such expanded ancestor.
   *
   * A directory is "expanded" if it is a session "Show All Files" dir (ExpandStore)
   * or an explicitly-added, persisted folder (AdmittedFolderStore) — either way its
   * subtree renders every file it contains.
   *
   * This is the single source of truth for "is this path shown in expanded mode".
   * It is derived from the stores on every render so it never goes stale, unlike a
   * flag carried on the node object (which VS Code may hand back from its cache).
   */
  private _scopeFor(p: string): Scope {
    const roots = new Set((vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath));
    let cur = p;
    for (;;) {
      if (this.expandStore.isExpanded(cur) || this.admittedFolderStore.has(cur)) {
        return { expanded: true, filter: this.expandStore.getFilter(cur) };
      }
      if (roots.has(cur)) return { expanded: false, filter: undefined };
      const parent = path.dirname(cur);
      if (parent === cur) return { expanded: false, filter: undefined };
      cur = parent;
    }
  }

  getParent(node: ExplorerNode): ExplorerNode | undefined {
    if (node.isWorkspaceRoot) return undefined;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return undefined;

    const parentPath = path.dirname(node.uri.fsPath);

    const parentWsFolder = workspaceFolders.find(f => f.uri.fsPath === parentPath);
    if (parentWsFolder) {
      if (workspaceFolders.length === 1) return undefined;
      return { uri: vscode.Uri.file(parentPath), isDirectory: true, isWorkspaceRoot: true };
    }

    return { uri: vscode.Uri.file(parentPath), isDirectory: true, isWorkspaceRoot: false };
  }

  getTreeItem(node: ExplorerNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.uri);
    const fsPath = node.uri.fsPath;
    const scope = this._scopeFor(fsPath);
    log(`getTreeItem ${fsPath} scope=${JSON.stringify(scope)}`);

    // Stable id: VS Code keys an item's identity (and its remembered expansion
    // state) on this. Keeping it stable lets an expanded directory survive a refresh
    // and re-fetch its children in the new scope — that's what makes "Show All Files"
    // reveal everything under an already-open directory. Collapsing is handled
    // separately via the built-in collapse-all command (see collapseToFiltered).
    item.id = fsPath;

    if (node.isDirectory) {
      const isAdmittedFolder = this.admittedFolderStore.has(fsPath);
      const sessionExpanded = this.expandStore.isExpanded(fsPath);
      const ownExpanded = isAdmittedFolder || sessionExpanded;
      item.collapsibleState = ownExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

      const hasFilter = this.expandStore.hasFilter(fsPath);
      const filter = this.expandStore.getFilter(fsPath);

      // A persisted admitted folder outranks a transient session expansion: it renders
      // the same "all files" contents but its menu offers "Remove from View" (un-admit)
      // rather than the session-only "Collapse to Filtered View".
      if (isAdmittedFolder) {
        if (node.isWorkspaceRoot) {
          item.contextValue = hasFilter
            ? 'seDir.workspaceRoot.admitted.filtered'
            : 'seDir.workspaceRoot.admitted';
        } else {
          item.contextValue = hasFilter ? 'seDir.admitted.filtered' : 'seDir.admitted';
        }
        item.description = filter ? `● filter: ${filter}` : '●';
      } else if (sessionExpanded) {
        if (node.isWorkspaceRoot) {
          item.contextValue = hasFilter
            ? 'seDir.workspaceRoot.expandedFiltered'
            : 'seDir.workspaceRoot.expanded';
        } else {
          item.contextValue = hasFilter ? 'seDir.expandedFiltered' : 'seDir.expanded';
        }
        item.description = filter ? `● filter: ${filter}` : '●';
      } else if (node.isWorkspaceRoot) {
        item.contextValue = 'seDir.workspaceRoot';
      } else if (scope.expanded) {
        item.contextValue = 'seDir.inExpanded';
      } else {
        item.contextValue = 'seDir.filtered';
      }
    } else {
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [node.uri],
      };
      item.contextValue = 'seFile';
      if (this.tabTracker.tabPaths.has(fsPath)) {
        item.description = '•';
      }
    }

    log(
      `  -> collapsibleState=${item.collapsibleState} contextValue=${item.contextValue} description=${item.description}`,
    );
    return item;
  }

  async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    if (!node) {
      if (workspaceFolders.length === 1) {
        return this._childrenOf(workspaceFolders[0].uri.fsPath);
      }
      return workspaceFolders.map(f => ({
        uri: f.uri,
        isDirectory: true,
        isWorkspaceRoot: true,
      }));
    }

    return this._childrenOf(node.uri.fsPath);
  }

  private async _childrenOf(dirPath: string): Promise<ExplorerNode[]> {
    const scope = this._scopeFor(dirPath);
    const result = scope.expanded
      ? await this._getExpandedChildren(dirPath, scope.filter)
      : await this._getFilteredChildren(dirPath);
    log(
      `getChildren ${dirPath} scope=${JSON.stringify(scope)} -> ${result.length} entries: [${result.map(n => path.basename(n.uri.fsPath)).join(', ')}]`,
    );
    return result;
  }

  private async _getFilteredChildren(dirPath: string): Promise<ExplorerNode[]> {
    const roots = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
    // Admitted folders are anchors too: they (and their ancestors) must appear in the
    // filtered tree even when none of their files have been opened. Their contents are
    // then rendered by _getExpandedChildren via the expanded scope.
    const anchors = new Set([...this.admittedStore.paths, ...this.admittedFolderStore.paths]);
    const visible = computeVisiblePaths(anchors, roots);

    const entries = await readDir(dirPath);
    const nodes: ExplorerNode[] = [];

    for (const entry of entries) {
      if (visible.has(entry.fullPath)) {
        nodes.push({
          uri: vscode.Uri.file(entry.fullPath),
          isDirectory: entry.isDirectory,
          isWorkspaceRoot: false,
        });
      }
    }

    return nodes.sort(compareNodes);
  }

  private async _getExpandedChildren(
    dirPath: string,
    filter: string | undefined,
  ): Promise<ExplorerNode[]> {
    // "Show all files" and explicitly-added folders read straight from disk, so this is
    // where we hide the noise the built-in Explorer hides (via files.exclude): .DS_Store,
    // .git, and friends. The filtered view is unaffected — it only ever shows files the
    // user explicitly opened/admitted, dotfiles included.
    const isExcluded = this._excludePredicateFor(dirPath);
    const entries = await readDir(dirPath);
    const nodes: ExplorerNode[] = [];

    for (const entry of entries) {
      if (isExcluded(entry.fullPath)) continue;

      if (!filter) {
        nodes.push({
          uri: vscode.Uri.file(entry.fullPath),
          isDirectory: entry.isDirectory,
          isWorkspaceRoot: false,
        });
      } else if (!entry.isDirectory) {
        if (entry.name.toLowerCase().includes(filter.toLowerCase())) {
          nodes.push({
            uri: vscode.Uri.file(entry.fullPath),
            isDirectory: false,
            isWorkspaceRoot: false,
          });
        }
      } else if (await hasMatchingDescendant(entry.fullPath, filter, isExcluded)) {
        nodes.push({
          uri: vscode.Uri.file(entry.fullPath),
          isDirectory: true,
          isWorkspaceRoot: false,
        });
      }
    }

    return nodes.sort(compareNodes);
  }

  /** The workspace root that contains `fsPath`, if any. */
  private _workspaceRootFor(fsPath: string): string | undefined {
    return (vscode.workspace.workspaceFolders ?? [])
      .map(f => f.uri.fsPath)
      .find(r => fsPath === r || fsPath.startsWith(r + path.sep));
  }

  /**
   * A predicate that reports whether an absolute path is hidden by the effective
   * `files.exclude` of its workspace folder. Built once per expanded-directory read and
   * reused for that directory's descendants (they share a root, so the same matcher applies).
   */
  private _excludePredicateFor(dirPath: string): (fullPath: string) => boolean {
    const root = this._workspaceRootFor(dirPath);
    if (!root) return () => false;

    const exclude = vscode.workspace
      .getConfiguration('files', vscode.Uri.file(root))
      .get<Record<string, unknown>>('exclude', {});
    const matcher = buildExcludeMatcher(exclude);

    return (fullPath: string) => {
      const rel = path.relative(root, fullPath).split(path.sep).join('/');
      return rel !== '' && matcher(rel);
    };
  }
}

function compareNodes(a: ExplorerNode, b: ExplorerNode): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1;
  }
  return path.basename(a.uri.fsPath).localeCompare(path.basename(b.uri.fsPath));
}
