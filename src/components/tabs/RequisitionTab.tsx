import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ScanLine, Check, ChevronsUpDown, Paperclip, X, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/QrScanner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Part { id: string; code: string; name: string; quantity: number; category: string; }
interface Item { category: string; partId: string; quantity: number; code: string; }

export default function RequisitionTab() {
  const [parts, setParts] = useState<Part[]>([]);
  const [items, setItems] = useState<Item[]>([{ category: "", partId: "", quantity: 1, code: "" }]);
  const [reason, setReason] = useState("");
  const [scanIdx, setScanIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // กรณีใช้ Supabase:
    supabase.from("parts")
      .select("id,code,name,quantity,category")
      .order("code")
      .then(({ data }) => setParts(data as Part[] || []));
  }, []);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const setItemByCode = (i: number, code: string) => {
    const p = parts.find((p) => p.code === code);
    if (p) {
      setItem(i, { code, partId: p.id, category: p.category });
    } else {
      setItem(i, { code, partId: "" });
    }
  };

  const submit = async () => {
    const valid = items.filter((it) => it.partId && it.quantity > 0);
    if (valid.length === 0) return toast.error("เพิ่มอย่างน้อย 1 รายการ");
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("กรุณาเข้าสู่ระบบ");

      let finalReason = reason;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `evidence/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('requisitions')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('requisitions')
          .getPublicUrl(filePath);

        finalReason = `${reason}||FILE_URL||${publicUrl}`;
      }

      const { data: req, error } = await supabase
        .from("requisitions")
        .insert({
          user_id: session.user.id,
          reason: finalReason,
          doc_number: ""
        })
        .select()
        .single();

      if (error || !req) throw error || new Error("ไม่สามารถสร้างใบเบิกได้");

      const itemsPayload = valid.map((it) => ({
        requisition_id: req.id,
        part_id: it.partId,
        quantity: it.quantity
      }));

      const { error: e2 } = await (supabase.from("requisition_items") as any).insert(itemsPayload);
      if (e2) throw e2;

      toast.success(`สร้างใบเบิก ${req.doc_number} สำเร็จ — รอเจ้าหน้าที่อนุมัติ`);
      setItems([{ category: "", partId: "", quantity: 1, code: "" }]);
      setReason("");
      setFile(null);
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <PackagePlus className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">เบิกอะไหล่</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="text-sm text-muted-foreground font-medium">รายการเบิกใหม่</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((arr) => [...arr, { category: "", partId: "", quantity: 1, code: "" }])}
            className="h-8 gap-2"
          >
            <Plus className="h-4 w-4" /> เพิ่มรายการ
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {items.map((it, i) => {
            const part = parts.find((p) => p.id === it.partId);
            const categories = Array.from(new Set(parts.map(p => p.category))).filter(Boolean);
            const filteredParts = parts.filter(p => p.category === it.category);

            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                {/* เลือกหมวดหมู่ (Dropdown) */}
                <div className="col-span-12 md:col-span-2 space-y-1">
                  <Label className="text-xs">กลุ่มสินค้า</Label>
                  <Select
                    value={it.category}
                    onValueChange={(val) => setItem(i, { category: val, partId: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกกลุ่ม" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* เลือกรหัสอะไหล่ */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="text-xs">รหัสอะไหล่</Label>

                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          disabled={!it.category}
                          className={cn(
                            "w-full justify-between font-normal",
                            !it.code && "text-muted-foreground"
                          )}
                        >
                          {it.code || (it.category ? "เลือกรหัส..." : "เลือกกลุ่มก่อน")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="ค้นหารหัสหรือชื่อ..." />
                          <CommandList>
                            <CommandEmpty>ไม่พบอะไหล่</CommandEmpty>
                            <CommandGroup>
                              {filteredParts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.code} ${p.name}`}
                                  onSelect={() => {
                                    setItemByCode(i, p.code);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      it.code === p.code ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{p.code}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.name} (คงเหลือ {p.quantity})
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Button type="button" size="icon" variant="outline" onClick={() => setScanIdx(i)}>
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* แสดงชื่ออะไหล่ / คงเหลือ */}
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="text-xs">ชื่ออะไหล่ / คงเหลือ</Label>
                  <div className="h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm truncate">
                    {part ? (
                      <span>
                        {part.name} <span className="text-muted-foreground ml-2">({part.quantity})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">ยังไม่ได้เลือก</span>
                    )}
                  </div>
                </div>

                {/* จำนวน */}
                <div className="col-span-8 md:col-span-2 space-y-1">
                  <Label className="text-xs">จำนวน</Label>
                  <Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
                </div>

                <div className="col-span-4 md:col-span-1 flex justify-center pb-0.5">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setItems((arr) => arr.filter((_, x) => x !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              แนบไฟล์หลักฐาน
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="flex items-center gap-1.5 bg-muted/50 pl-2 pr-1 py-1 rounded-md border animate-in fade-in zoom-in duration-200">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-[200px]">
                  {file.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setFile(null);
                    const input = document.getElementById("file-upload") as HTMLInputElement;
                    if (input) input.value = "";
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "กำลังส่ง..." : "สร้างใบเบิก"}
          </Button>
        </CardContent>

        <QrScanner
          open={scanIdx !== null}
          onOpenChange={(o) => !o && setScanIdx(null)}
          onScan={(t) => scanIdx !== null && setItemByCode(scanIdx, t)}
        />
      </Card>
    </div>
  );
}
