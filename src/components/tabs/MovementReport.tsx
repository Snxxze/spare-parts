import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

interface Movement { quantity: number; created_at: string; type: string; }

export function MovementReport({ type, title }: { type: "issue" | "refill"; title: string }) {
  const [data, setData] = useState<Movement[]>([]);
  const [view, setView] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    supabase.from("stock_movements").select("quantity,created_at,type").eq("type", type).then(({ data }) => setData(data || []));
  }, [type]);

  const grouped = data.reduce<Record<string, number>>((acc, m) => {
    const key = format(new Date(m.created_at), view === "daily" ? "yyyy-MM-dd" : "yyyy-MM");
    acc[key] = (acc[key] || 0) + m.quantity;
    return acc;
  }, {});
  const chart = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, qty]) => ({ date, qty }));
  const total = data.reduce((s, m) => s + m.quantity, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-2">
          <button onClick={() => setView("daily")} className={`px-3 py-1 rounded text-sm border ${view === "daily" ? "bg-primary text-primary-foreground" : ""}`}>รายวัน</button>
          <button onClick={() => setView("monthly")} className={`px-3 py-1 rounded text-sm border ${view === "monthly" ? "bg-primary text-primary-foreground" : ""}`}>รายเดือน</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">รวมจำนวนทั้งหมด</p>
          <p className="text-3xl font-semibold">{total.toLocaleString()}</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
