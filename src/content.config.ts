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
  }),
});

// Expose your defined collection to Astro
// with the `collections` export
export const collections = { settings };
