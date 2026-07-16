import type { CollectionEntry } from 'astro:content';

export interface Ancestor {
  title: string;
  href: string;
}

export interface ChildLink {
  title: string;
  href: string;
  subtitle?: string;
}

export interface PageNode {
  id: string;
  title: string;
  /** Full URL with a leading slash, e.g. `/painting/series-a`. */
  route: string;
  /** Root-first ancestor chain (excludes self), for breadcrumbs. */
  ancestors: Ancestor[];
  subtitle?: string;
  cover_image?: string;
  gallery?: string[];
  template?: 'index' | 'show';
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

    const { title, subtitle, cover_image, gallery, template, parent: parentId } = entry.data;
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

    const node: PageNode = { id, title, route, ancestors, subtitle, cover_image, gallery, template };
    nodes.set(id, node);
    return node;
  };

  for (const p of pages) build(p.id, new Set());
  return nodes;
}

/**
 * Sorted child links of a page — the published pages that declare `parentId`
 * as their `parent`, ordered by the *parent's* `sort.by`/`order` config (default
 * title/asc when `sort` is unset, matching the schema's nullish handling). Shared
 * by the homepage section accordion and the per-page child listing so the two
 * never disagree. `allPages` should already be draft-filtered by the caller.
 */
export function sortedChildren(
  allPages: CollectionEntry<'pages'>[],
  tree: Map<string, PageNode>,
  parentId: string,
): ChildLink[] {
  const parent = allPages.find((p) => p.id === parentId);
  const sortField = (n: PageNode) => {
    const value = parent?.data.sort?.by === 'subtitle' ? n.subtitle : n.title;
    return (value ?? '').toLowerCase();
  };
  const dir = parent?.data.sort?.order === 'desc' ? -1 : 1;

  return allPages
    .filter((p) => p.data.parent === parentId && p.id !== parentId)
    .map((p) => tree.get(p.id)!)
    .sort((a, b) => (sortField(a) < sortField(b) ? -1 * dir : 1 * dir))
    .map((n) => ({ title: n.title, href: n.route, subtitle: n.subtitle }));
}
