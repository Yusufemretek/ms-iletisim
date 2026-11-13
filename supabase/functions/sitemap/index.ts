import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: products } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true)
      .not("slug", "is", null);

    const SITE_URL = "https://msiletisim.com";

    const staticUrls = [
      { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" },
      { loc: `${SITE_URL}/urunler`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/telefonlar`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/ikinci-el-telefonlar`, priority: "0.8", changefreq: "daily" },
      { loc: `${SITE_URL}/aksesuarlar`, priority: "0.8", changefreq: "daily" },
      { loc: `${SITE_URL}/tabletler`, priority: "0.8", changefreq: "daily" },
      { loc: `${SITE_URL}/akilli-saatler`, priority: "0.8", changefreq: "daily" },
      { loc: `${SITE_URL}/teknik-servis`, priority: "0.7", changefreq: "weekly" },
      { loc: `${SITE_URL}/operator-kampanyalari`, priority: "0.7", changefreq: "weekly" },
    ];

    const productUrls = (products || [])
      .filter((p: { slug: string | null }) => p.slug)
      .map((p: { slug: string; updated_at: string }) => ({
        loc: `${SITE_URL}/urun/${p.slug}`,
        priority: "0.6",
        changefreq: "weekly",
        lastmod: p.updated_at ? p.updated_at.split("T")[0] : undefined,
      }));

    const allUrls = [...staticUrls, ...productUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
