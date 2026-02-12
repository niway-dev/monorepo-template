import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

/** Page data including MDX plugin methods (e.g. getText) added by fumadocs-mdx at runtime */
type PageDataWithMDX = InferPageType<typeof source>["data"] & {
  getText: (format: string) => Promise<string>;
};

export async function getLLMText(page: InferPageType<typeof source>) {
  const data = page.data as PageDataWithMDX;
  const processed = await data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
