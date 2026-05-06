import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, LogOut, Boxes, PackagePlus, ShieldCheck, ClipboardList, History, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import PartsTab from "@/components/tabs/PartsTab";
import RequisitionTab from "@/components/tabs/RequisitionTab";
import ApprovalsTab from "@/components/tabs/ApprovalsTab";
import StockReportTab from "@/components/tabs/StockReportTab";
import IssueReportTab from "@/components/tabs/IssueReportTab";
import RefillReportTab from "@/components/tabs/RefillReportTab";
import { Skeleton } from "@/components/ui/skeleton";
import { findEmployee, hasFullAccess, type EmployeeRole } from "@/lib/employees";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [role, setRole] = useState<EmployeeRole | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    document.title = "Spare Parts Requisition System";
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      setSessionChecked(true); // มีเซสชันแล้ว ให้เริ่มวาดโครงแอปได้
      const uid = session.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();
      const name = profile?.full_name || "";
      const emp = await findEmployee(name);
      if (!emp) {
        // Roster may have changed (renamed/removed) — block access
        await supabase.auth.signOut();
        // Also remove their PIN registry so a new name+PIN can be set up
        if (name) await supabase.from("employee_pins").delete().eq("name", name);
        toast.error("ไม่พบชื่อในทะเบียนพนักงาน กรุณาติดต่อผู้ดูแล");
        navigate("/auth", { replace: true });
        return;
      }
      setUserName(emp.name);
      setRole(emp.role);
      // Sync warehouse role for staff/owner
      if (hasFullAccess(emp.role)) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        if (!roles?.some((r) => r.role === "warehouse")) {
          await supabase.from("user_roles").insert({ user_id: uid, role: "warehouse" });
        }
      }
      setLoading(false);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate("/auth", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("ออกจากระบบแล้ว");
  };

  // ถ้ายังไม่รู้เลยว่ามีเซสชันไหม ให้เงียบไว้ก่อน (หรือโชว์ Spinner กลางจอแบบ Minimal)
  if (!sessionChecked) return null;

  const fullAccess = hasFullAccess(role);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              {loading ? (
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <>
                  <h1 className="font-semibold leading-tight">Spare Parts Requisition System</h1>
                  <p className="text-xs text-muted-foreground">{userName} • {role}</p>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="h-8">
            <LogOut className="h-4 w-4 mr-2" /> ออกจากระบบ
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="parts">
          <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto flex-wrap gap-0">
            <TabsTrigger value="parts" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
              <Boxes className="h-4 w-4" /> ข้อมูลอะไหล่
            </TabsTrigger>
            <TabsTrigger value="requisition" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
              <PackagePlus className="h-4 w-4" /> เบิกอะไหล่
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
              <ClipboardList className="h-4 w-4" /> สินค้าคงคลัง
            </TabsTrigger>
            {(loading || fullAccess) && (
              <>
                <TabsTrigger value="approvals" disabled={loading} className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                  <ShieldCheck className="h-4 w-4" /> อนุมัติเบิก
                </TabsTrigger>
                <TabsTrigger value="issues" disabled={loading} className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                  <History className="h-4 w-4" /> ประวัติเบิกจ่าย
                </TabsTrigger>
                <TabsTrigger value="refills" disabled={loading} className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                  <BarChart3 className="h-4 w-4" /> รายงานสรุป
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="parts" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <PartsTab />
          </TabsContent>
          <TabsContent value="requisition" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <RequisitionTab />
          </TabsContent>
          <TabsContent value="stock" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <StockReportTab />
          </TabsContent>
          {fullAccess && (
            <>
              <TabsContent value="approvals" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
                <ApprovalsTab />
              </TabsContent>
              <TabsContent value="issues" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
                <IssueReportTab />
              </TabsContent>
              <TabsContent value="refills" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
                <RefillReportTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
