import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Req {
  id: string;
  doc_number: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
  requisition_items: { quantity: number; parts: { code: string; name: string } }[];
}

export default function ApprovalsTab() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("requisitions")
        .select("id,doc_number,user_id,reason,status,created_at,requisition_items(quantity,parts(code,name))")
        .order("created_at", { ascending: false });
      if (filter === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      
      const userIds = Array.from(new Set((data || []).map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", userIds);
      const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
      setReqs(((data as any[]) || []).map((r) => ({ ...r, profiles: profMap.get(r.user_id) })) as Req[]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  // Helper สำหรับแกะข้อมูล Reason และ Image
  const parseReason = (rawReason: string | null) => {
    if (!rawReason) return { text: "", image: null };
    const parts = rawReason.split("||FILE||");
    return {
      text: parts[0],
      image: parts[1] || null,
    };
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("requisitions")
      .update({ status, reviewed_by: session?.user.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "ยืนยันการเบิกแล้ว" : "ปฏิเสธการเบิกแล้ว");
    load();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">อนุมัติเบิกอะไหล่</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")} className="h-8">รออนุมัติ</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} className="h-8">ทั้งหมด</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="text-sm text-muted-foreground font-medium">รายการที่ต้องตรวจสอบ</div>
        </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          // Skeleton Loading State
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="flex-1 h-20 rounded-md" />
                <Skeleton className="h-20 w-20 rounded-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="flex-1 h-9 rounded-md" />
                <Skeleton className="flex-1 h-9 rounded-md" />
              </div>
            </div>
          ))
        ) : reqs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">ไม่มีรายการ</p>
        ) : (
          reqs.map((r) => {
          const { image } = parseReason(r.reason);
          
          return (
            <div key={r.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{r.doc_number}</p>
                  <p className="text-sm text-muted-foreground">
                    ผู้เบิก: {r.profiles?.full_name || r.profiles?.email || r.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    เวลา: {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </p>
                </div>
                <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>
                  {r.status === "pending" ? "รออนุมัติ" : r.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                </Badge>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-1 rounded border bg-muted/30 p-2 text-sm min-h-[80px]">
                  {r.requisition_items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="font-mono">{it.parts.code}</span>
                      <span className="flex-1 mx-2">{it.parts.name}</span>
                      <span>x {it.quantity}</span>
                    </div>
                  ))}
                </div>

                {image && (
                  <div className="shrink-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="block border rounded-md overflow-hidden bg-white hover:opacity-80 transition-opacity">
                          <img src={image} alt="Attachment" className="h-[80px] w-[80px] object-cover" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>หลักฐานการเบิกอะไหล่</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center items-center p-1">
                          <img 
                            src={image} 
                            alt="Full Attachment" 
                            className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg" 
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>

              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={() => review(r.id, "approved")} className="flex-1">ยืนยัน</Button>
                  <Button variant="outline" onClick={() => review(r.id, "rejected")} className="flex-1">ไม่ยืนยัน</Button>
                </div>
              )}
            </div>
          );
        })
      )}
      </CardContent>
    </Card>
  </div>
  );
}
