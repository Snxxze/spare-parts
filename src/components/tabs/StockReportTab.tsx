import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcw, Package, CheckCircle2, AlertTriangle, Coins, ClipboardList } from "lucide-react";

interface Part { id: string; code: string; name: string; quantity: number; min_stock_alert: number; unit_price: number; }

export default function StockReportTab() {
  const [parts, setParts] = useState<Part[]>([]);
  const [sortDesc, setSortDesc] = useState(true);
  const [onlyLow, setOnlyLow] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("parts")
        .select("id,code,name,quantity,min_stock_alert,unit_price");
      setParts(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // คำนวณสถิติ
  const totalCount = parts.length;
  const lowStockCount = parts.filter(p => p.quantity <= p.min_stock_alert).length;
  const normalCount = totalCount - lowStockCount;
  const totalValue = parts.reduce((acc, p) => acc + (p.quantity * (p.unit_price || 0)), 0);

  let view = [...parts].sort((a, b) => sortDesc ? b.quantity - a.quantity : a.quantity - b.quantity);
  if (onlyLow) view = view.filter((p) => p.quantity <= p.min_stock_alert);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">สินค้าคงคลัง</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-8 gap-1.5">
          <RefreshCcw className="h-3.5 w-3.5" /> รีเฟรช
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-100 border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">สินค้าทั้งหมด</span>
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
                    <Package className="h-4 w-4 text-slate-600" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-slate-800">{totalCount}</p>
                <p className="text-xs mt-1 text-slate-500">รายการในระบบ</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50 border-emerald-100">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">สต็อกปกติ</span>
                  <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-emerald-700">{normalCount}</p>
                <p className="text-xs mt-1 text-emerald-400">รายการ</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-rose-50 border-rose-100">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">ใกล้หมด / หมด</span>
                  <div className="h-9 w-9 rounded-full bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-rose-600">{lowStockCount}</p>
                <p className="text-xs mt-1 text-rose-400">รายการ</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50 border-blue-100">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">มูลค่าคงคลัง</span>
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <Coins className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-blue-700">{totalValue.toLocaleString()}</p>
                <p className="text-xs mt-1 text-blue-400">บาท</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2 pb-4">
          <div className="text-sm text-muted-foreground font-medium">รายการอะไหล่</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSortDesc((s) => !s)} className="h-8" disabled={loading}>
              เรียง: {sortDesc ? "มาก → น้อย" : "น้อย → มาก"}
            </Button>
            <Button size="sm" variant={onlyLow ? "default" : "outline"} onClick={() => setOnlyLow((v) => !v)} className="h-8" disabled={loading}>
              {onlyLow ? "แสดงทั้งหมด" : "ดูเฉพาะใกล้หมด"}
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-right">ขั้นต่ำ</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : (
                view.map((p) => {
                  const low = p.quantity <= p.min_stock_alert;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">{p.min_stock_alert}</TableCell>
                      <TableCell>
                        {low ? <Badge variant="destructive">ใกล้หมด</Badge> : <Badge variant="secondary">ปกติ</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
