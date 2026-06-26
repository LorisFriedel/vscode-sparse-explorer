import * as path from 'path';

export function computeVisiblePaths(
  admittedPaths: Set<string>,
  workspaceRoots: string[],
): Set<string> {
  const visible = new Set<string>();

  for (const itemPath of admittedPaths) {
    const root = workspaceRoots.find(
      r => itemPath === r || itemPath.startsWith(r + path.sep),
    );
    if (!root) continue;

    visible.add(itemPath);

    let p = path.dirname(itemPath);
    while (p.length > root.length && p.startsWith(root + path.sep)) {
      visible.add(p);
      p = path.dirname(p);
    }
  }

  return visible;
}
