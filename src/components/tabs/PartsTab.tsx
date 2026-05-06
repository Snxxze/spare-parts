import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, Boxes } from "lucide-react";
import { toast } from "sonner";

interface Part {
  id: string;
  code: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  expiry_date: string | null;
  min_stock_alert: number;
}

const CATEGORIES = ["กลุ่มที่ 1", "กลุ่มที่ 2"];

export default function PartsTab() {
  const [parts, setParts] = useState<Part[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("parts").select("*").order("code");
      if (error) throw error;
      setParts((data as Part[]) || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    const { error } = await supabase.functions.invoke("sync-parts");
    setSyncing(false);
    if (error) return toast.error(error.message);
    toast.success("ซิงค์ข้อมูลจากชีทเรียบร้อย");
    load();
  };

  useEffect(() => { load(); sync(); }, []);

  const codesInCategory = useMemo(
    () => parts.filter((p) => p.category === category),
    [parts, category]
  );
  const selected = useMemo(() => parts.find((p) => p.code === code) || null, [parts, code]);

  const openNew = () => {
    setEditing(null); setCategory(""); setCode(""); setQuantity(0); setOpen(true);
  };
  const openEdit = (p: Part) => {
    setEditing(p); setCategory(p.category || ""); setCode(p.code); setQuantity(p.quantity); setOpen(true);
  };

  const save = async () => {
    if (!selected) return toast.error("กรุณาเลือกหมวดหมู่และรหัส");
    const { error } = await supabase.from("parts")
      .update({ quantity: Number(quantity) })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("บันทึกจำนวนสำเร็จ");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("ลบอะไหล่นี้?")) return;
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบสำเร็จ"); load();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">ข้อมูลอะไหล่</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing} className="h-8 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            ซิงค์ข้อมูล
          </Button>
          <Button size="sm" onClick={openNew} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> เพิ่ม/แก้ไขจำนวน
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="text-sm text-muted-foreground font-medium">ตารางข้อมูลอะไหล่ทั้งหมด</div>
        </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่ออะไหล่</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead>หน่วย</TableHead>
                <TableHead className="text-right">ราคา/หน่วย</TableHead>
                <TableHead>วันหมดอายุ</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : parts.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูล</TableCell></TableRow>
              ) : (
                parts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.category || "-"}</TableCell>
                    <TableCell className="font-mono">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell>{p.unit || "-"}</TableCell>
                    <TableCell className="text-right">{Number(p.unit_price).toFixed(2)}</TableCell>
                    <TableCell>{p.expiry_date || "-"}</TableCell>
                    <TableCell className="text-right">{p.min_stock_alert}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "แก้ไขจำนวน" : "เลือกอะไหล่"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setCode(""); }}>
                <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>รหัสสินค้า</Label>
              <Select value={code} onValueChange={setCode} disabled={!category}>
                <SelectTrigger><SelectValue placeholder="เลือกรหัส" /></SelectTrigger>
                <SelectContent>
                  {codesInCategory.map((p) => (
                    <SelectItem key={p.id} value={p.code}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <>
                <div className="space-y-2">
                  <Label>ชื่ออะไหล่</Label>
                  <Input value={selected.name} readOnly className="bg-muted" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>จำนวน</Label>
                    <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>หน่วย (คงที่)</Label>
                    <Input value={selected.unit || ""} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>ราคา/หน่วย</Label>
                    <Input value={Number(selected.unit_price).toFixed(2)} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder point</Label>
                    <Input value={selected.min_stock_alert} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>วันหมดอายุ</Label>
                    <Input value={selected.expiry_date || "-"} readOnly className="bg-muted" />
                  </div>
                </div>
              </>
            )}
            <Button onClick={save} className="w-full" disabled={!selected}>บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>
      </Card>
    </div>
  );
}
