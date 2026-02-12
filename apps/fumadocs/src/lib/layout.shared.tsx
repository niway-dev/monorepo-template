import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Monorepo Template Docs",
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
      },
    ],
  };
}
