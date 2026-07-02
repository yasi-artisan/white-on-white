import type { CollectionEntry } from 'astro:content';

export interface Ancestor {
  title: string;
  href: string;
}

export interface PageNode {
  id: string;
  title: string;
  /** Full URL with a leading slash, e.g. `/painting/series-a`. */
  route: string;
  /** Root-first ancestor chain (excludes self), for breadcrumbs. */
  ancestors: Ancestor[];
}

/**
 * Build a virtual page tree from flat files plus an optional `parent` relation.
 *
 * Files stay flat under `src/data/pages` (title → slug → filename). URL nesting
 * is derived from each page's `parent` — a parent page's slug — so a chain
 * `grandparent → parent → child` yields the route `/grandparent/parent/child`.
 * Each node also carries its ancestor chain for breadcrumbs.
 *
 * This keeps nesting in frontmatter (not folders), so Sveltia's blank-segment
 * random-UUID fallback can never fire. Cycles in the parent chain are broken
 * defensively so malformed data can't loop forever.
 */
export function buildPageTree(
  pages: CollectionEntry<'pages'>[],
): Map<string, PageNode> {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const nodes = new Map<string, PageNode>();

  const build = (id: string, seen: Set<string>): PageNode => {
    const cached = nodes.get(id);
    if (cached) return cached;

    const entry = byId.get(id);
    if (!entry) {
      const orphan: PageNode = { id, title: id, route: `/${id}`, ancestors: [] };
      nodes.set(id, orphan);
      return orphan;
    }

    const parentId = entry.data.parent;
    let route: string;
    let ancestors: Ancestor[];

    if (
      parentId &&
      parentId !== id &&
      byId.has(parentId) &&
      !seen.has(parentId)
    ) {
      const parent = build(parentId, new Set([...seen, id]));
      route = `${parent.route}/${id}`;
      ancestors = [
        ...parent.ancestors,
        { title: parent.title, href: parent.route },
      ];
    } else {
      route = `/${id}`;
      ancestors = [];
    }

    const node: PageNode = { id, title: entry.data.title, route, ancestors };
    nodes.set(id, node);
    return node;
  };

  for (const p of pages) build(p.id, new Set());
  return nodes;
}
