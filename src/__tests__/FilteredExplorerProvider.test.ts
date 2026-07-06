import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ExpandStore } from '../ExpandStore';
import { FilteredExplorerProvider, ExplorerNode } from '../FilteredExplorerProvider';

// Pull in the mocked vscode so tests can control workspace folders.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

// Minimal stubs — FilteredExplorerProvider only reads .tabPaths and .paths/.has.
const tabTracker = { tabPaths: new Set<string>() } as any;
const admittedStore = { paths: new Set<string>() } as any;
const admittedFolderStore = {
  paths: new Set<string>(),
  has(p: string): boolean {
    return (this.paths as Set<string>).has(p);
  },
} as any;

function makeProvider(expandStore: ExpandStore): FilteredExplorerProvider {
  return new FilteredExplorerProvider(tabTracker, admittedStore, expandStore, admittedFolderStore);
}

function node(fsPath: string, isDirectory = true, isWorkspaceRoot = false): ExplorerNode {
  return { uri: { fsPath } as any, isDirectory, isWorkspaceRoot };
}

describe('getTreeItem — contextValue', () => {
  beforeEach(() => {
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/root' } }];
    admittedStore.paths = new Set<string>();
    admittedFolderStore.paths = new Set<string>();
    tabTracker.tabPaths = new Set<string>();
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = undefined;
  });

  test('unexpanded non-root dir gets seDir.filtered', () => {
    const expandStore = new ExpandStore();
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.filtered');
  });

  test('dir that is itself expanded gets seDir.expanded', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.expanded');
  });

  test('dir that is itself expanded with a filter gets seDir.expandedFiltered', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    expandStore.setFilter('/root/src', 'test');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.expandedFiltered');
    expect(item.description).toBe('● filter: test');
  });

  test('expanded dir with no filter gets a bullet description', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.description).toBe('●');
  });

  test('child dir of an expanded dir gets seDir.inExpanded', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src/utils'));
    expect(item.contextValue).toBe('seDir.inExpanded');
  });

  test('deeply nested child of an expanded dir gets seDir.inExpanded', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src/utils/helpers'));
    expect(item.contextValue).toBe('seDir.inExpanded');
  });

  test('workspace root not expanded gets seDir.workspaceRoot', () => {
    const expandStore = new ExpandStore();
    const item = makeProvider(expandStore).getTreeItem(node('/root', true, true));
    expect(item.contextValue).toBe('seDir.workspaceRoot');
  });

  test('workspace root expanded gets seDir.workspaceRoot.expanded', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root');
    const item = makeProvider(expandStore).getTreeItem(node('/root', true, true));
    expect(item.contextValue).toBe('seDir.workspaceRoot.expanded');
  });

  test('workspace root expanded with filter gets seDir.workspaceRoot.expandedFiltered', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root');
    expandStore.setFilter('/root', 'ts');
    const item = makeProvider(expandStore).getTreeItem(node('/root', true, true));
    expect(item.contextValue).toBe('seDir.workspaceRoot.expandedFiltered');
  });

  test('admitted folder gets seDir.admitted and renders expanded', () => {
    admittedFolderStore.paths = new Set(['/root/src']);
    const item = makeProvider(new ExpandStore()).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.admitted');
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
    // Shares the fork's expanded-dir hint (● = "showing all files").
    expect(item.description).toBe('●');
  });

  test('admitted folder with a session filter gets seDir.admitted.filtered', () => {
    admittedFolderStore.paths = new Set(['/root/src']);
    const expandStore = new ExpandStore();
    expandStore.setFilter('/root/src', 'test');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.admitted.filtered');
    expect(item.description).toBe('● filter: test');
  });

  test('admitted workspace root gets seDir.workspaceRoot.admitted', () => {
    admittedFolderStore.paths = new Set(['/root']);
    const item = makeProvider(new ExpandStore()).getTreeItem(node('/root', true, true));
    expect(item.contextValue).toBe('seDir.workspaceRoot.admitted');
  });

  test('child dir of an admitted folder gets seDir.inExpanded', () => {
    admittedFolderStore.paths = new Set(['/root/src']);
    const item = makeProvider(new ExpandStore()).getTreeItem(node('/root/src/utils'));
    expect(item.contextValue).toBe('seDir.inExpanded');
  });

  test('admitted folder outranks a concurrent session expansion', () => {
    admittedFolderStore.paths = new Set(['/root/src']);
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.admitted');
  });

  test('file gets seFile contextValue', () => {
    const expandStore = new ExpandStore();
    const item = makeProvider(expandStore).getTreeItem(node('/root/src/foo.ts', false));
    expect(item.contextValue).toBe('seFile');
  });

  test('open file gets bullet description', () => {
    const expandStore = new ExpandStore();
    tabTracker.tabPaths = new Set(['/root/src/foo.ts']);
    const item = makeProvider(expandStore).getTreeItem(node('/root/src/foo.ts', false));
    expect(item.description).toBe('•');
  });

  test('closed file has no description', () => {
    const expandStore = new ExpandStore();
    tabTracker.tabPaths = new Set<string>();
    const item = makeProvider(expandStore).getTreeItem(node('/root/src/foo.ts', false));
    expect(item.description).toBeUndefined();
  });

  // Regression: scope must be re-derived from the stores on every getTreeItem call,
  // not cached on the node object. Before the fix, inExpandedContext was stored on the
  // node; VS Code's item cache could hand back a stale node with a stale flag.
  test('contextValue updates after collapseAll on the same node object', () => {
    const expandStore = new ExpandStore();
    expandStore.expand('/root/src');
    const provider = makeProvider(expandStore);
    const n = node('/root/src/utils');

    expect(provider.getTreeItem(n).contextValue).toBe('seDir.inExpanded');

    expandStore.collapseAll();

    // Same node instance — but scope must be re-derived from the now-empty store.
    expect(provider.getTreeItem(n).contextValue).toBe('seDir.filtered');
  });

  test('_scopeFor stops at workspace root and does not walk past it', () => {
    // /root is the workspace root. /root/src is not expanded. /root is not expanded.
    // A node at /root/src should be seDir.filtered, not crash or give a wrong answer.
    const expandStore = new ExpandStore();
    const item = makeProvider(expandStore).getTreeItem(node('/root/src'));
    expect(item.contextValue).toBe('seDir.filtered');
  });
});

describe('getChildren', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparse-provider-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'));
    await fs.mkdir(path.join(tmpDir, 'lib'));
    await fs.writeFile(path.join(tmpDir, 'src', 'a.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'src', 'b.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'lib', 'c.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'README.md'), '');
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    admittedStore.paths = new Set<string>();
    admittedFolderStore.paths = new Set<string>();
    vscode.__setFilesExclude({});
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
    vscode.workspace.workspaceFolders = undefined;
    vscode.__setFilesExclude({});
  });

  test('filtered mode: only shows dirs that contain admitted files', async () => {
    admittedStore.paths = new Set([path.join(tmpDir, 'src', 'a.ts')]);
    const expandStore = new ExpandStore();
    const children = await makeProvider(expandStore).getChildren();
    const names = children.map(n => path.basename(n.uri.fsPath));
    expect(names).toContain('src');
    expect(names).not.toContain('lib');
    expect(names).not.toContain('README.md');
  });

  test('filtered mode: shows nothing when no files are admitted', async () => {
    admittedStore.paths = new Set<string>();
    const expandStore = new ExpandStore();
    const children = await makeProvider(expandStore).getChildren();
    expect(children).toHaveLength(0);
  });

  test('expanded mode: shows all entries regardless of admittedStore', async () => {
    admittedStore.paths = new Set<string>();
    const expandStore = new ExpandStore();
    expandStore.expand(tmpDir);
    const children = await makeProvider(expandStore).getChildren();
    const names = children.map(n => path.basename(n.uri.fsPath)).sort();
    expect(names).toEqual(['README.md', 'lib', 'src'].sort());
  });

  test('expanded mode with filter: excludes files/dirs that do not match', async () => {
    admittedStore.paths = new Set<string>();
    const expandStore = new ExpandStore();
    expandStore.expand(tmpDir);
    expandStore.setFilter(tmpDir, '.ts');  // matches .ts files
    const children = await makeProvider(expandStore).getChildren();
    const names = children.map(n => path.basename(n.uri.fsPath));
    // src and lib contain .ts files; README.md does not
    expect(names).toContain('src');
    expect(names).toContain('lib');
    expect(names).not.toContain('README.md');
  });

  test('admitted folder appears and shows all its files with nothing admitted', async () => {
    admittedStore.paths = new Set<string>();
    admittedFolderStore.paths = new Set([path.join(tmpDir, 'src')]);

    // The folder surfaces at the root level even though no file was opened...
    const rootChildren = await makeProvider(new ExpandStore()).getChildren();
    const rootNames = rootChildren.map(n => path.basename(n.uri.fsPath));
    expect(rootNames).toContain('src');
    expect(rootNames).not.toContain('lib');
    expect(rootNames).not.toContain('README.md');

    // ...and its contents are fully listed (expanded scope).
    const srcNode = rootChildren.find(n => path.basename(n.uri.fsPath) === 'src')!;
    const srcNames = (await makeProvider(new ExpandStore()).getChildren(srcNode))
      .map(n => path.basename(n.uri.fsPath))
      .sort();
    expect(srcNames).toEqual(['a.ts', 'b.ts']);
  });

  test('ancestors of a nested admitted folder are shown', async () => {
    await fs.mkdir(path.join(tmpDir, 'src', 'deep'));
    await fs.writeFile(path.join(tmpDir, 'src', 'deep', 'd.ts'), '');
    admittedStore.paths = new Set<string>();
    admittedFolderStore.paths = new Set([path.join(tmpDir, 'src', 'deep')]);

    const rootChildren = await makeProvider(new ExpandStore()).getChildren();
    expect(rootChildren.map(n => path.basename(n.uri.fsPath))).toContain('src');

    const srcNode = rootChildren.find(n => path.basename(n.uri.fsPath) === 'src')!;
    // src is an ancestor (filtered scope): it shows only the path to the admitted folder,
    // not its sibling files a.ts / b.ts.
    const srcNames = (await makeProvider(new ExpandStore()).getChildren(srcNode)).map(n =>
      path.basename(n.uri.fsPath),
    );
    expect(srcNames).toEqual(['deep']);
  });

  test('expanded mode hides files.exclude matches (.DS_Store)', async () => {
    await fs.writeFile(path.join(tmpDir, '.DS_Store'), '');
    await fs.writeFile(path.join(tmpDir, 'src', '.DS_Store'), '');
    vscode.__setFilesExclude({ '**/.DS_Store': true });

    const expandStore = new ExpandStore();
    expandStore.expand(tmpDir);
    const provider = makeProvider(expandStore);

    const rootNames = (await provider.getChildren()).map(n => path.basename(n.uri.fsPath));
    expect(rootNames).not.toContain('.DS_Store');
    expect(rootNames).toEqual(expect.arrayContaining(['src', 'lib', 'README.md']));

    // ...and nested too.
    const srcNode = (await provider.getChildren()).find(
      n => path.basename(n.uri.fsPath) === 'src',
    )!;
    const srcNames = (await provider.getChildren(srcNode)).map(n => path.basename(n.uri.fsPath));
    expect(srcNames).not.toContain('.DS_Store');
    expect(srcNames).toEqual(expect.arrayContaining(['a.ts', 'b.ts']));
  });

  test('admitted folder hides files.exclude matches', async () => {
    await fs.writeFile(path.join(tmpDir, 'src', '.DS_Store'), '');
    vscode.__setFilesExclude({ '**/.DS_Store': true });
    admittedFolderStore.paths = new Set([path.join(tmpDir, 'src')]);

    const provider = makeProvider(new ExpandStore());
    const srcNode = (await provider.getChildren()).find(
      n => path.basename(n.uri.fsPath) === 'src',
    )!;
    const srcNames = (await provider.getChildren(srcNode)).map(n => path.basename(n.uri.fsPath));
    expect(srcNames).not.toContain('.DS_Store');
    expect(srcNames.sort()).toEqual(['a.ts', 'b.ts']);
  });

  test('a dotfile the user opened still shows in the filtered view', async () => {
    // Filtered mode must not apply files.exclude — an explicitly-admitted .env is shown.
    await fs.writeFile(path.join(tmpDir, '.env'), '');
    vscode.__setFilesExclude({ '**/.DS_Store': true, '**/.env': true });
    admittedStore.paths = new Set([path.join(tmpDir, '.env')]);

    const rootNames = (await makeProvider(new ExpandStore()).getChildren()).map(n =>
      path.basename(n.uri.fsPath),
    );
    expect(rootNames).toContain('.env');
  });

  test('dirs sort before files within the same level', async () => {
    admittedStore.paths = new Set([
      path.join(tmpDir, 'src', 'a.ts'),
      path.join(tmpDir, 'README.md'),
    ]);
    const expandStore = new ExpandStore();
    const children = await makeProvider(expandStore).getChildren();
    const firstIsDir = children[0].isDirectory;
    expect(firstIsDir).toBe(true);
  });
});
