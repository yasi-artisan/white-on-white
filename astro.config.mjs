// @ts-check
import { defineConfig } from 'astro/config';
import { fontProviders } from 'astro/config'
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: "Satoshi",
      cssVariable: "--font-satoshi",
    },
    {
      provider: fontProviders.fontshare(),
      name: "Clash Display",
      cssVariable: "--font-display",
    }
  ],
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});