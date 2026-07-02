// @ts-check
import { defineConfig } from 'astro/config';
import { fontProviders } from 'astro/config'
import cloudflare from '@astrojs/cloudflare';

import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),

  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: "Satoshi",
      cssVariable: "--font-satoshi",
      weights: ["400", "700"],
    },
    {
      provider: fontProviders.fontshare(),
      name: "Clash Display",
      cssVariable: "--font-display",
      weights: ["400", "500"],
    }
  ],

  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },

  integrations: [mdx()],
});