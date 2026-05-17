const escapeRegex = (char: string): string => char.replace(/[\\^$+?{}()|[\]]/g, '\\$&');

const globToRegex = (pattern: string): RegExp => {
  let regexStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern.charAt(i);
    if (char === '*' && pattern.charAt(i + 1) === '*') {
      regexStr += '.*';
      i += 2;
      if (pattern.charAt(i) === '.') i++;
    } else if (char === '*') {
      regexStr += '[^.]*';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += escapeRegex(char);
      i++;
    }
  }
  regexStr += '$';
  return new RegExp(regexStr);
};

export const matchGlob = (pattern: string, route: string): boolean =>
  globToRegex(pattern).test(route);

export const filterRoutes = (
  routes: ReadonlyArray<string>,
  expose?: string[],
  deny?: string[],
): string[] => {
  let filtered = [...routes];

  if (expose && expose.length > 0) {
    filtered = filtered.filter((route) => expose.some((pattern) => matchGlob(pattern, route)));
  }

  if (deny && deny.length > 0) {
    filtered = filtered.filter((route) => !deny.some((pattern) => matchGlob(pattern, route)));
  }

  return filtered;
};
