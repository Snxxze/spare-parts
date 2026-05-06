import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Package, Coins, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";

interface Part {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  min_stock_alert: number;
}

interface Movement {
  id: string;
  part_id: string;
  quantity: number;
  type: string;
  created_at: string;
}

interface TopItem {
  code: string;
  name: string;
  total: number;
}

export default function RefillReportTab() {
  const [parts, setParts] = useState<Part[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: partsData }, { data: movData }] = await Promise.all([
        supabase.from("parts").select("id,code,name,quantity,unit,unit_price,min_stock_alert"),
        supabase.from("stock_movements").select("id,part_id,quantity,type,created_at").order("created_at", { ascending: false }),
      ]);
      setParts(partsData || []);
      setMovements(movData || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // คำนวณสถิติ
  const totalParts = parts.length;
  const totalValue = parts.reduce((a, p) => a + (p.quantity * (p.unit_price || 0)), 0);
  const refillCount = movements.filter(m => m.type === "refill").length;
  const issueCount = movements.filter(m => m.type === "issue").length;

  // รับสินค้า 5 อันดับล่าสุด
  const latestRefills = movements
    .filter(m => m.type === "refill")
    .slice(0, 5)
    .map(m => {
      const p = parts.find(pt => pt.id === m.part_id);
      return { ...m, partName: p?.name || "N/A", partCode: p?.code || "N/A" };
    });

  // เบิกสินค้าบ่อยที่สุด (top 5)
  const issueAgg = movements
    .filter(m => m.type === "issue")
    .reduce<Record<string, number>>((acc, m) => {
      acc[m.part_id] = (acc[m.part_id] || 0) + m.quantity;
      return acc;
    }, {});
  const topIssued: TopItem[] = Object.entries(issueAgg)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([pid, total]) => {
      const p = parts.find(pt => pt.id === pid);
      return { code: p?.code || "N/A", name: p?.name || "N/A", total };
    });

  // สินค้าที่ต้องสั่งซื้อเพิ่ม
  const lowStockParts = parts.filter(p => p.quantity <= p.min_stock_alert);

  // Stats card config
  const stats = [
    { icon: Package,         label: "จำนวนสินค้า",      value: totalParts,                  sub: "รายการในระบบ", gradient: "from-white to-slate-100",    border: "border-slate-200",   iconBg: "bg-slate-100",    iconColor: "text-slate-600",    numColor: "text-slate-800",    subColor: "text-slate-500"    },
    { icon: Coins,           label: "มูลค่าคงคลัง",      value: totalValue.toLocaleString(), sub: "บาท",           gradient: "from-white to-blue-50",     border: "border-blue-100",    iconBg: "bg-blue-100",     iconColor: "text-blue-600",     numColor: "text-blue-700",     subColor: "text-blue-400"     },
    { icon: ArrowDownToLine, label: "รับสินค้าทั้งหมด",  value: refillCount,                 sub: "ครั้ง",          gradient: "from-white to-emerald-50",  border: "border-emerald-100", iconBg: "bg-emerald-100",  iconColor: "text-emerald-600",  numColor: "text-emerald-700",  subColor: "text-emerald-400"  },
    { icon: ArrowUpFromLine, label: "เบิกสินค้าทั้งหมด", value: issueCount,                  sub: "ครั้ง",          gradient: "from-white to-amber-50",    border: "border-amber-100",   iconBg: "bg-amber-100",    iconColor: "text-amber-600",    numColor: "text-amber-700",    subColor: "text-amber-400"    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">รายงานสรุป</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : stats.map((s, i) => (
              <Card key={i} className={`overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br ${s.gradient} ${s.border}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                    <div className={`h-9 w-9 rounded-full ${s.iconBg} flex items-center justify-center`}>
                      <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                    </div>
                  </div>
                  <p className={`text-4xl font-bold ${s.numColor}`}>{s.value}</p>
                  <p className={`text-xs mt-1 ${s.subColor}`}>{s.sub}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Middle Row: 2 cards side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* รับสินค้า 5 อันดับล่าสุด */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
              รับสินค้า 5 อันดับล่าสุด
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : latestRefills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-2">
                {latestRefills.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{r.partCode}</span>
                      <span>{r.partName}</span>
                    </div>
                    <Badge variant="secondary" className="font-normal">+{r.quantity}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* เบิกสินค้าบ่อยที่สุด */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ArrowUpFromLine className="h-4 w-4 text-amber-500" />
              เบิกสินค้าบ่อยที่สุด
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : topIssued.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-2">
                {topIssued.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{t.code}</span>
                      <span>{t.name}</span>
                    </div>
                    <Badge variant="outline" className="font-normal">รวม {t.total}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: สินค้าที่ต้องสั่งซื้อเพิ่ม */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600">
            <AlertTriangle className="h-4 w-4" />
            สินค้าที่ต้องสั่งซื้อเพิ่ม
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : lowStockParts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">ไม่มีสินค้าที่ต้องสั่งซื้อเพิ่ม 🎉</p>
          ) : (
            <div className="space-y-2">
              {lowStockParts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <span>{p.name}</span>
                  </div>
                  {p.quantity === 0 ? (
                    <Badge variant="destructive" className="font-normal">หมดสต็อก</Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal text-rose-600 bg-rose-50 border-rose-200">
                      เหลือ {p.quantity} {p.unit || "ชิ้น"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
