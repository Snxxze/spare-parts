import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHEET_ID = "151cXSlyI_abwUt6tsmks1NnbMAAQpPv-tg-2CwlpCYA";
const SHEETS = ["กลุ่มที่ 1", "กลุ่มที่ 2"];

async function fetchSheet(name: string) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const rows = json.table.rows;
  const out: any[] = [];
  for (const r of rows) {
    const c = r.c || [];
    const code = c[0]?.v;
    const nm = c[1]?.v;
    if (!code || !nm || code === "รหัส") continue;
    const price = Number(c[2]?.v ?? 0);
    const unit = c[3]?.v ?? "";
    let expiry: string | null = null;
    const ev = c[4]?.v;
    if (typeof ev === "string" && ev.startsWith("Date(")) {
      const m = ev.match(/Date\((\d+),(\d+),(\d+)/);
      if (m) expiry = `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
    } else if (ev) expiry = String(ev);
    const rop = Number(c[5]?.v ?? 0) || 0;
    out.push({ code, name: nm, category: name, unit_price: price, unit, expiry_date: expiry, min_stock_alert: rop });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SB_URL")!, Deno.env.get("SB_SERVICE_ROLE_KEY")!);
    const all: any[] = [];
    for (const s of SHEETS) all.push(...(await fetchSheet(s)));

    // Upsert each
    for (const p of all) {
      const { data: existing } = await supabase.from("parts").select("id, quantity").eq("code", p.code).maybeSingle();
      if (existing) {
        await supabase.from("parts").update({
          name: p.name, category: p.category, unit_price: p.unit_price,
          unit: p.unit, expiry_date: p.expiry_date, min_stock_alert: p.min_stock_alert,
        }).eq("id", existing.id);
      } else {
        await supabase.from("parts").insert({ ...p, quantity: 0 });
      }
    }
    // Remove parts not in sheet
    const codes = all.map((p) => p.code);
    if (codes.length) {
      await supabase.from("parts").delete().not("code", "in", `(${codes.map((c) => `"${c}"`).join(",")})`);
    }
    return new Response(JSON.stringify({ ok: true, count: all.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
