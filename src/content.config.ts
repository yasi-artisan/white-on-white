import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const settings = defineCollection({
  loader: glob({ pattern: "settings.yaml", base: "src/data" }),
  schema: z.object({
    siteName: z.string(),
    menuLinks: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    footerLinks: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    landingPageSettings: z.object({
      links: z.array(
        z.object({
          label: z.string(),
          href: z.string(),
          shape: z.string(),
        }),
      ),
    }),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.{mdx,md}", base: "src/data/pages" }),
  schema: z.object({
    title: z.string(),
    // Page shape: `index` renders its children (a listing); `show` renders the
    // body/gallery content. Defaults to `show` for back-compat with pages that
    // predate the field.
    template: z.enum(["index", "show"]).default("show"),
    subtitle: z.string().optional(),
    draft: z.boolean().default(true),
    // Slug of an optional parent page (Sveltia `relation`, value_field {{slug}}).
    // Drives virtual URL nesting + breadcrumbs — see src/utils/pages.ts. Nullish
    // because Sveltia writes `null` for an unset single-select relation.
    parent: z.string().nullish(),
    cover_image: z.string().optional(),
    featured_image_size: z
      .enum(["w-sm", "w-lg", "w-full"])
      .default("w-full")
      .optional(),
    gallery: z.array(z.string()).optional(),
    sort: z
      .object({
        by: z.enum(["title", "subtitle"]).default("subtitle").optional(),
        order: z.enum(["asc", "desc"]).default("desc").optional(),
      })
      // `.nullish()` (not `.optional()`) so Sveltia's `sort: null` — written when
      // the object field is cleared — validates. `.optional()` accepts undefined
      // but rejects null.
      .nullish(),
  }),
});

// Expose your defined collection to Astro
// with the `collections` export
export const collections = { settings, pages };
