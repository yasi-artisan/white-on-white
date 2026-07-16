// @ts-check
import { defineConfig } from 'astro/config';
import { fontProviders } from 'astro/config'

import mdx from '@astrojs/mdx';
import vercelAdapter from '@astrojs/vercel';

import sveltiaCMS from 'astro-sveltia-cms';

// https://astro.build/config
export default defineConfig({
  // adapter: cloudflare(),
   output: 'static',
  adapter: vercelAdapter({
    imageService: true,
    webAnalytics: {
      enabled: true,
    },
  }),

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

  integrations: [mdx(), sveltiaCMS()],
});