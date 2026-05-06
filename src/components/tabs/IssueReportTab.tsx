import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, History, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HistoryItem {
  id: string;
  doc_number: string;
  created_at: string;
  status: string;
  reason: string | null;
  user_id: string;
  reviewed_by: string | null;
  requester_name: string;
  reviewer_name: string;
  items: {
    part_name: string;
    part_code: string;
    quantity: number;
    unit_price: number;
  }[];
  total_value: number;
}

export default function IssueReportTab() {
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูล Requisitions พร้อมรายการสินค้า
      const { data: reqs, error: reqError } = await supabase
        .from("requisitions")
        .select(`
          *,
          requisition_items (
            quantity,
            parts (name, code, unit_price)
          )
        `)
        .order("created_at", { ascending: false });

      if (reqError) throw reqError;

      // 2. รวบรวม User IDs ทั้งหมด (ทั้งคนเบิกและคนอนุมัติ) เพื่อดึงชื่อทีเดียว
      const allUserIds = new Set<string>();
      reqs?.forEach(r => {
        if (r.user_id) allUserIds.add(r.user_id);
        if (r.reviewed_by) allUserIds.add(r.reviewed_by);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", Array.from(allUserIds));

      const profMap = new Map(profiles?.map(p => [p.user_id, p.full_name || p.email || "ไม่ระบุ"]));

      // 3. แปลงข้อมูลให้อยู่ในรูปแบบที่แสดงผลง่าย
      const formatted: HistoryItem[] = (reqs || []).map(r => {
        const items = (r.requisition_items as any[] || []).map(it => ({
          part_name: it.parts?.name || "N/A",
          part_code: it.parts?.code || "N/A",
          quantity: it.quantity,
          unit_price: it.parts?.unit_price || 0
        }));

        const total_value = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);

        return {
          id: r.id,
          doc_number: r.doc_number,
          created_at: r.created_at,
          status: r.status,
          reason: r.reason,
          user_id: r.user_id,
          reviewed_by: r.reviewed_by,
          requester_name: profMap.get(r.user_id) || "ระบบ",
          reviewer_name: r.reviewed_by ? (profMap.get(r.reviewed_by) || "ไม่พบข้อมูล") : "-",
          items,
          total_value
        };
      });

      setData(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredData = useMemo(() => {
    const s = search.toLowerCase();
    return data.filter(item => 
      item.doc_number.toLowerCase().includes(s) ||
      item.requester_name.toLowerCase().includes(s) ||
      item.items.some(it => it.part_name.toLowerCase().includes(s))
    );
  }, [data, search]);

  const parseImage = (reason: string | null) => {
    if (!reason) return null;
    const parts = reason.split("||FILE||");
    return parts[1] || null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">ประวัติการเบิกจ่ายอะไหล่</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่เอกสาร, ชื่อผู้เบิก, หรือชื่ออะไหล่..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[150px]">วันที่/เวลา</TableHead>
                  <TableHead>เลขที่เอกสาร</TableHead>
                  <TableHead>รายการอะไหล่</TableHead>
                  <TableHead>ผู้เบิก</TableHead>
                  <TableHead>ยอดรวม</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-center">หลักฐาน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      ไม่พบประวัติการเบิกจ่าย
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    const img = parseImage(item.reason);
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="text-xs">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{item.doc_number}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate text-xs">
                            {item.items.map(it => `${it.part_name} (x${it.quantity})`).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{item.requester_name}</TableCell>
                        <TableCell className="font-medium text-sm">
                          ฿{item.total_value.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}
                            className="font-normal text-[10px] uppercase"
                          >
                            {item.status === "approved" ? "อนุมัติ" : item.status === "pending" ? "รอตรวจ" : "ปฏิเสธ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {img ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>หลักฐานการเบิก - {item.doc_number}</DialogTitle>
                                </DialogHeader>
                                <div className="flex justify-center p-2">
                                  <img src={img} alt="Proof" className="max-h-[70vh] rounded-lg shadow-md" />
                                </div>
                                <div className="text-xs text-muted-foreground text-center">
                                  เบิกโดย: {item.requester_name} | อนุมัติโดย: {item.reviewer_name}
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
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
