import type { ImageMetadata } from 'astro';
import { getCldImageUrl } from 'astro-cloudinary/helpers';

/**
 * The three image origins this site renders, picked by inspecting the source
 * string the CMS stores in frontmatter:
 *
 * - `cloudinary` — a full Cloudinary delivery URL (`res.cloudinary.com/...`).
 *   Optimized via `astro-cloudinary` URL transforms (no build-time fetch).
 * - `local` — a repo-relative path resolved through `import.meta.glob` so Astro's
 *   `<Image>` optimizer processes it. Lives under `src/assets/media` (NOT `public/`,
 *   which Astro skips).
 * - `remote` — any other absolute URL; handed to Astro `<Image>` with `inferSize`.
 */
export type ImageSource = 'cloudinary' | 'local' | 'remote';

/**
 * Gallery tiles render at a single right-sized width (no srcset). 800px covers
 * the mosaic's largest tile (~400px display) at 2x density. Crucially, 800 is
 * also an entry in DETAIL_WIDTHS, so the tile and the detail view share ONE
 * cached Cloudinary bitmap — that hot bitmap is what lets the view-transition
 * morph land correctly on back-navigation across engines (Gecko snapshots the
 * destination before its image loads, so the URL must already be cached).
 */
export const GALLERY_SRC_WIDTH = 800;

/** Tuned responsive widths (px) for the full-size detail view (includes 800). */
export const DETAIL_WIDTHS = [800, 1200, 1600, 2000] as const;
/** `sizes` for the detail view's up-to-60rem stage. */
export const DETAIL_SIZES = '(min-width: 960px) 60rem, 92vw';

/** True when `src` points at a Cloudinary delivery URL. */
export function isCloudinary(src: string): boolean {
  return /^https?:\/\/res\.cloudinary\.com\//.test(src);
}

/** Classify a stored image source into one of the three rendering branches. */
export function classifyImage(src: string): ImageSource {
  if (isCloudinary(src)) return 'cloudinary';
  if (/^https?:\/\//.test(src)) return 'remote';
  return 'local';
}

export interface ParsedCloudinary {
  cloudName: string;
  publicId: string;
}

/**
 * Split a Cloudinary delivery URL into its cloud name + public id.
 *
 * Strips the host and the `<assetType>/<delivery>` segment (and an optional
 * `v<version>/`), so we can rebuild the URL with `getCldImageUrl` using an
 * explicit cloud name rather than relying on the url-loader's URL inference.
 *
 *   https://res.cloudinary.com/dgpqqcuyf/image/upload/v1782905646/foo_bar.webp
 *     → { cloudName: 'dgpqqcuyf', publicId: 'foo_bar' }
 */
export function parseCloudinaryUrl(src: string): ParsedCloudinary {
  const m = src.match(
    /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/(?:image|images|video|videos)\/upload\/(?:v\d+\/)?(.+)$/,
  );
  if (!m) throw new Error(`Unrecognized Cloudinary URL: ${src}`);
  // Drop any trailing format segment Cloudinary may have baked in (`foo.webp` →
  // `foo`) so getCldImageUrl controls the output format via `format: 'auto'`.
  const publicId = m[2].replace(/\.(jpe?g|png|webp|avif|gif|svg)$/i, '');
  return { cloudName: m[1], publicId };
}

/**
 * Build a single Cloudinary transform URL for a given pixel width with
 * automatic format + quality negotiation (f_auto,q_auto).
 */
export function cloudinarySrc(
  src: string,
  width: number,
): string {
  const { cloudName, publicId } = parseCloudinaryUrl(src);
  return getCldImageUrl(
    { src: publicId, width, format: 'auto', quality: 'auto' },
    { cloud: { cloudName } },
  );
}

/**
 * Build a responsive `srcset` string (`<url> <w>w, ...`) for a Cloudinary URL
 * across the given widths.
 */
export function cloudinarySrcset(src: string, widths: readonly number[]): string {
  return widths.map((w) => `${cloudinarySrc(src, w)} ${w}w`).join(', ');
}

const dimCache = new Map<
  string,
  { width: number; height: number } | undefined
>();

/**
 * Read a Cloudinary image's ORIGINAL dimensions at build time via Cloudinary's
 * `fl_getinfo` (returns JSON `{"input":{"width","height",...}}`), so the `<img>`
 * can carry width/height and reserve its box before load. With intrinsic
 * dimensions the view-transition snapshot is correct on a cold first visit
 * regardless of whether the bytes have decoded yet — race-free, no decoding.
 * Returns undefined on any failure; callers then omit the attributes and degrade.
 */
export async function cloudinaryDimensions(
  src: string,
): Promise<{ width: number; height: number } | undefined> {
  if (!isCloudinary(src)) return undefined;
  if (dimCache.has(src)) return dimCache.get(src);
  let result: { width: number; height: number } | undefined;
  try {
    const { cloudName, publicId } = parseCloudinaryUrl(src);
    const url = `https://res.cloudinary.com/${cloudName}/image/upload/fl_getinfo/${publicId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as {
      input?: { width?: number; height?: number };
    };
    const w = json.input?.width;
    const h = json.input?.height;
    if (w && h) result = { width: w, height: h };
  } catch {
    result = undefined;
  }
  dimCache.set(src, result);
  return result;
}

// Eager-import every local asset so Astro's optimizer processes them at build.
// Keys are repo paths like "/src/assets/media/foo.jpg".
// `import: 'default'` is essential: without it, eager glob returns the module
// namespace `{ default: ImageMetadata }`, so `.src` would be undefined and every
// local image would render with no src (and Astro's image endpoint would receive
// href=undefined → "UnsupportedImageFormat ... from undefined").
const localAssets = import.meta.glob<ImageMetadata>(
  '/src/assets/media/**/*.{jpg,jpeg,png,webp,avif,gif,svg}',
  { eager: true, import: 'default' },
);

// Index by repo path (with + without leading slash) and by basename, so a
// stored frontmatter value resolves regardless of how it's written.
const localByPath: Record<string, ImageMetadata> = {};
const localByName: Record<string, ImageMetadata> = {};
for (const [key, meta] of Object.entries(localAssets)) {
  localByPath[key] = meta; // "/src/assets/media/foo.jpg"
  localByPath[key.replace(/^\/+/, '')] = meta; // "src/assets/media/foo.jpg"
  localByName[key.split('/').pop() as string] = meta; // "foo.jpg"
}

/**
 * Resolve a stored local path to Astro `ImageMetadata`, or `undefined` if the
 * file isn't under `src/assets/media`. The CMS stores the conventional
 * `public_folder` path (`/media/foo.jpg`); files physically live under
 * `src/assets/media`, so map `/media/` → `src/assets/media/` before lookup.
 * Falls back to the raw path and then the basename. Callers render a plain
 * `<img>` when this returns nothing.
 */
export function resolveLocalImage(src: string): ImageMetadata | undefined {
  if (!src) return undefined;
  const repoPath = src
    .replace(/^\/+/, '')
    .replace(/^media\//, 'src/assets/media/');
  return (
    localByPath[repoPath] ??
    localByPath[src.replace(/^\/+/, '')] ??
    localByName[src.split('/').pop() as string]
  );
}
