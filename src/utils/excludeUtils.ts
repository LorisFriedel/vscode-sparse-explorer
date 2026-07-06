/**
 * Minimal support for VS Code's `files.exclude` globs, used to hide the same
 * "classic hidden files" the built-in Explorer hides (`.DS_Store`, `.git`, …)
 * from expanded / explicitly-added folders.
 *
 * We handle the glob syntax that actually appears in `files.exclude`: `**`, `*`,
 * `?`, and `{a,b}` alternation. Character classes (`[abc]`) are treated as
 * literals, and conditional excludes (a `{ "when": … }` value) are ignored — those
 * files simply stay visible.
 */

/** Convert a single `files.exclude` glob to a RegExp anchored to a whole relative path. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  let braceDepth = 0;

  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    switch (c) {
      case '*':
        if (glob[i + 1] === '*') {
          i++; // consume the second '*'
          if (glob[i + 1] === '/') {
            i++; // consume the '/'
            re += '(?:.*/)?'; // '**/' — zero or more leading path segments
          } else {
            re += '.*'; // '**' — anything, including path separators
          }
        } else {
          re += '[^/]*'; // '*' — anything within a single path segment
        }
        break;
      case '?':
        re += '[^/]';
        break;
      case '{':
        braceDepth++;
        re += '(?:';
        break;
      case '}':
        if (braceDepth > 0) {
          braceDepth--;
          re += ')';
        } else {
          re += '\\}';
        }
        break;
      case ',':
        re += braceDepth > 0 ? '|' : ',';
        break;
      default:
        // Escape any regex metacharacter; everything else (letters, '/', '-', …) is literal.
        re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        break;
    }
  }

  return new RegExp('^' + re + '$');
}

/**
 * Build a predicate over workspace-relative POSIX paths from a `files.exclude`-style
 * map. Only patterns whose value is exactly `true` are active (a `false` un-hides;
 * a conditional object value is skipped).
 */
export function buildExcludeMatcher(
  exclude: Record<string, unknown> | undefined,
): (relativePosixPath: string) => boolean {
  const regexes = Object.entries(exclude ?? {})
    .filter(([, active]) => active === true)
    .map(([glob]) => globToRegExp(glob));

  if (regexes.length === 0) return () => false;
  return (relativePosixPath: string) => regexes.some(re => re.test(relativePosixPath));
}
