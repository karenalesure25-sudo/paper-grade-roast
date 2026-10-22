import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site";

/** Public, indexable pages only. Private order pages and API routes are never listed. */
export const SITEMAP_PATHS = ["/", "/roast", "/order/revamp", "/order/scratch", "/order/bundle", "/order-help", "/terms", "/privacy"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = SITEMAP_PATHS.map((p) => `  <url><loc>${PUBLIC_SITE_ORIGIN}${p}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
