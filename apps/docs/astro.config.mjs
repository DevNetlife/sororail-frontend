// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Published to GitHub Pages at https://sororail.github.io/sororail-frontend/.
// `site` and `base` must match the Pages URL, or asset and link paths break.
// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site: "https://sororail.github.io",
  base: "/sororail-frontend",
  integrations: [
    starlight({
      title: "SoroRail",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Sororail/sororail-frontend",
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Getting started", slug: "getting-started" },
            { label: "Troubleshooting", slug: "troubleshooting" },
          ],
        },
        {
          label: "Concepts",
          items: [{ autogenerate: { directory: "concepts" } }],
        },
        {
          label: "Recipes",
          items: [{ autogenerate: { directory: "recipes" } }],
        },
      ],
    }),
  ],
});
