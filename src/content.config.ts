import { defineCollection, reference } from "astro:content";
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
    subtitle: z.string().optional(),
    draft: z.boolean().default(true),
    path: z.string(),
    gallery: z.array(z.string()).optional(),
    parents: z.array(reference("pages")).optional(),
  }),
});

// Expose your defined collection to Astro
// with the `collections` export
export const collections = { settings, pages };
