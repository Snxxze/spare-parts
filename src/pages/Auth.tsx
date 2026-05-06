import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { fetchRoster, nameToEmail, pinToPassword, hasFullAccess, type Employee } from "@/lib/employees";

export default function Auth() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [step, setStep] = useState<"name" | "login" | "setup">("name");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "เข้าสู่ระบบ | Spare Parts Requisition System";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/app", { replace: true });
    });
  }, [navigate]);

  const checkName = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const roster = await fetchRoster(true);
      const emp = roster.find((r) => r.name === name.trim());
      if (!emp) {
        toast.error("ชื่อไม่ถูกต้อง ไม่สามารถล็อกอินเข้าได้");
        return;
      }
      setEmployee(emp);
      const { data } = await supabase
        .from("employee_pins")
        .select("name")
        .eq("name", emp.name)
        .maybeSingle();
      setStep(data ? "login" : "setup");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const setupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (!/^\d{4,6}$/.test(pin)) return toast.error("รหัสต้องเป็นตัวเลข 4-6 หลัก");
    if (pin !== pin2) return toast.error("รหัสไม่ตรงกัน");
    setLoading(true);
    try {
      const email = await nameToEmail(employee.name);
      const password = pinToPassword(pin);
      const su = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: employee.name } },
      });
      if (su.error) throw su.error;
      if (!su.data.session) {
        const si = await supabase.auth.signInWithPassword({ email, password });
        if (si.error) throw si.error;
      }
      await supabase.from("employee_pins").insert({
        name: employee.name,
        user_id: (await supabase.auth.getSession()).data.session?.user.id,
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (session && hasFullAccess(employee.role)) {
        await supabase.from("user_roles").insert({ user_id: session.user.id, role: "warehouse" }).then(() => {});
      }
      toast.success(`ตั้งรหัสและเข้าสู่ระบบสำเร็จ`);
      navigate("/app", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "ตั้งรหัสไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setLoading(true);
    try {
      const email = await nameToEmail(employee.name);
      const password = pinToPassword(pin);
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) {
        toast.error("รหัสไม่ถูกต้อง");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session && hasFullAccess(employee.role)) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        if (!roles?.some((r) => r.role === "warehouse")) {
          await supabase.from("user_roles").insert({ user_id: session.user.id, role: "warehouse" });
        }
      }
      toast.success(`ยินดีต้อนรับ ${employee.name}`);
      navigate("/app", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/40 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Spare Parts Requisition System</CardTitle>
          <CardDescription>Octopus เอ็นจิเนียริ่ง จำกัด</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "name" && (
            <form onSubmit={checkName} className="space-y-4">
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล</Label>
                <Input required placeholder="กรอกชื่อตามทะเบียนพนักงาน" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "กำลังตรวจสอบ..." : "ถัดไป"}</Button>
            </form>
          )}
          {step === "setup" && employee && (
            <form onSubmit={setupPin} className="space-y-4">
              <p className="text-sm text-muted-foreground">ตั้งรหัสผ่านครั้งแรกสำหรับ <b>{employee.name}</b> ({employee.role})</p>
              <div className="space-y-2">
                <Label>รหัสผ่าน (4-6 หลัก)</Label>
                <Input type="password" inputMode="numeric" required value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ยืนยันรหัสผ่าน</Label>
                <Input type="password" inputMode="numeric" required value={pin2} onChange={(e) => setPin2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึกและเข้าสู่ระบบ"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("name"); setPin(""); setPin2(""); }}>ย้อนกลับ</Button>
            </form>
          )}
          {step === "login" && employee && (
            <form onSubmit={login} className="space-y-4">
              <p className="text-sm text-muted-foreground">เข้าสู่ระบบในชื่อ <b>{employee.name}</b></p>
              <div className="space-y-2">
                <Label>รหัสผ่าน</Label>
                <Input type="password" inputMode="numeric" required value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("name"); setPin(""); }}>ย้อนกลับ</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
