import { corsHeaders } from "../_shared/cors.ts";

const SHEET_ID = "151cXSlyI_abwUt6tsmks1NnbMAAQpPv-tg-2CwlpCYA";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const text = await res.text();
    const employees = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [role, ...rest] = line.split(",");
        const name = rest.join(",").trim().replace(/^"|"$/g, "");
        return { role: role.trim(), name };
      })
      .filter((e) => e.role && e.name);
    return new Response(JSON.stringify({ employees }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
