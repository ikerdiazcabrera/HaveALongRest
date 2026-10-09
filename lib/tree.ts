type TreeItem = { id: string; parentId: string | null; title: string; icon: string };

/** Lista en orden de árbol (padre seguido de sus hijas) con su profundidad, para selects. */
export function flattenTree<T extends TreeItem>(items: T[]): (T & { depth: number })[] {
  const ids = new Set(items.map((i) => i.id));
  const childrenOf = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), item]);
  }
  const out: (T & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const item of childrenOf.get(parent) ?? []) {
      out.push({ ...item, depth });
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Ids de una página y todas sus descendientes. */
export function descendantIds(items: { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const result = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId && result.has(item.parentId) && !result.has(item.id)) {
        result.add(item.id);
        grew = true;
      }
    }
  }
  return result;
}
