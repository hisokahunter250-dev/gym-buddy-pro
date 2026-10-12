import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SubscriptionForm, defaultSub, savePayment, finalAmount, type SubValues } from "@/components/subscription-form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, UserPlus, Trash2, RefreshCw, LogIn, LogOut as LogOutIcon, Search } from "lucide-react";
import { toast } from "sonner";
import type { Member, TrainingType, AttendanceRow } from "@/lib/gym-types";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "الحضور اليومي - الجيم" }, { name: "description", content: "متابعة الحضور والانصراف اليومي واشتراكات أعضاء الجيم." }, { property: "og:title", content: "الحضور اليومي - الجيم" }, { property: "og:description", content: "متابعة الحضور والانصراف اليومي واشتراكات أعضاء الجيم." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AttendancePage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AttendancePage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [trainingType, setTrainingType] = useState<string>("");

  // New member form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSub, setNewSub] = useState<SubValues | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSub, setRenewSub] = useState<SubValues | null>(null);
  const [nextCode, setNextCode] = useState<number | null>(null);

  const { data: trainings = [] } = useQuery({
    queryKey: ["training_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_types").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as TrainingType[];
    },
  });

  useEffect(() => {
    if (!trainingType && trainings.length) setTrainingType(trainings[0].name);
    if (!newSub && trainings.length) setNewSub(defaultSub(trainings));
  }, [trainings, trainingType, newSub]);

  const { data: matches = [] } = useQuery({
    queryKey: ["members-search", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const isNum = /^\d+$/.test(search.trim());
      const q = supabase.from("members").select("*").limit(8);
      const { data, error } = isNum
        ? await q.eq("code", Number(search))
        : await q.ilike("name", `${search}%`);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    enabled: search.trim().length > 0 && mode === "existing",
  });

  const { data: today = [] } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, members(code, name)")
        .eq("attendance_date", todayISO())
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (mode !== "new") return;
    supabase.rpc("next_member_code").then(({ data }) => setNextCode(data as number));
  }, [mode]);

  const { data: status } = useQuery({
    queryKey: ["member-status", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data: pay } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", selected!.id)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pay) return { kind: "none" as const };
      const today = todayISO();
      const expired = pay.end_date < today;
      let used = 0;
      if ((pay as any).sessions_total > 0) {
        const { count } = await supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("member_id", selected!.id)
          .gte("attendance_date", pay.start_date);
        used = count ?? 0;
      }
      const total = (pay as any).sessions_total as number;
      const remaining = total > 0 ? Math.max(0, total - used) : null;
      return { kind: "active" as const, payment: pay, expired, total, used, remaining };
    },
  });

  const recordAttendance = async (m: Member) => {
    if (!trainingType) return toast.error("اختر نوع التدريب");
    if (status?.kind === "active") {
      if (status.expired) return toast.error("الاشتراك منتهي");
      if (status.remaining !== null && status.remaining <= 0) return toast.error("انتهت حصص الاشتراك");
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("attendance").insert({
      member_id: m.id,
      training_type: trainingType,
      attendance_date: todayISO(),
      recorded_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`تم تسجيل حضور ${m.name}`);
    setSelected(null);
    setSearch("");
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
    qc.invalidateQueries({ queryKey: ["member-status"] });
  };

  const checkOut = async (id: string) => {
    const { error } = await supabase.from("attendance").update({ checked_out_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الانصراف");
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
  };

  const deleteAttendance = async (id: string, name?: string) => {
    if (!confirm(`حذف حضور ${name ?? ""}؟`)) return;
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الحضور");
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
    qc.invalidateQueries({ queryKey: ["member-status"] });
  };

  const openRenew = () => {
    setRenewSub(defaultSub(trainings, trainingType));
    setRenewOpen(true);
  };

  const doRenew = async () => {
    if (!selected || !renewSub) return;
    if (!renewSub.training) return toast.error("اختر نوع التدريب");
    if (finalAmount(renewSub) <= 0 && !confirm("المبلغ صفر، متابعة؟")) return;
    const { error } = await savePayment(selected.id, renewSub);
    if (error) return toast.error(error.message);
    setTrainingType(renewSub.training);
    toast.success(`تم تجديد اشتراك ${selected.name}`);
    setRenewOpen(false);
    qc.invalidateQueries();
  };

  const addNewMember = async () => {
    if (!newName.trim()) return toast.error("ادخل اسم العميل");
    if (!newSub?.training) return toast.error("اختر نوع التدريب");
    if (!newSub.amount || Number(newSub.amount) <= 0) return toast.error("ادخل مبلغ الاشتراك");
    const code = nextCode ?? 1001;
    const { data: member, error } = await supabase.from("members").insert({
      code, name: newName.trim(), phone: newPhone.trim() || null,
    }).select().single();
    if (error) return toast.error(error.message);
    const { error: pErr } = await savePayment(member.id, newSub);
    if (pErr) toast.error(pErr.message);
    setTrainingType(newSub.training);
    toast.success(`تم إضافة العضو • الكود ${code}`);
    setNewName(""); setNewPhone(""); setNewSub(defaultSub(trainings));
    setSelected(member as Member);
    setMode("existing");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="existing"><LogIn className="size-4 ml-1" />عضو حالي</TabsTrigger>
          <TabsTrigger value="new"><UserPlus className="size-4 ml-1" />عضو جديد</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "existing" ? (
        <Card className="p-6 space-y-4 shadow-card">
          <div className="grid md:grid-cols-[1fr_240px] gap-4">
            <div className="space-y-2">
              <Label>الكود أو الاسم</Label>
              <div className="relative">
                <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                  placeholder="اكتب الكود أو أول حروف من الاسم"
                  className="pr-10 text-lg num"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>نوع التدريب</Label>
              <Select value={trainingType} onValueChange={setTrainingType}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {trainings.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {search && matches.length > 0 && (
            <div className="space-y-2">
              {matches.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full text-right p-3 rounded-lg border transition-all ${selected?.id === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">{m.name}</span>
                    <Badge variant="outline" className="num text-gold border-gold/50">#{m.code}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          {search && matches.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
          )}

          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg gradient-hero shadow-glow flex-wrap gap-3">
                <div className="text-primary-foreground">
                  <p className="text-sm opacity-90">العضو المحدد</p>
                  <p className="text-xl font-black">{selected.name} • #{selected.code}</p>
                  {status?.kind === "active" && (
                    <p className="text-sm opacity-95 mt-1">
                      {status.expired
                        ? <span className="font-black">⛔ الاشتراك منتهي منذ <span className="num">{status.payment.end_date}</span></span>
                        : status.remaining !== null
                          ? status.remaining > 0
                            ? <>متبقي <span className="num font-black">{status.remaining}</span> من <span className="num">{status.total}</span> حصة</>
                            : "⛔ انتهت الحصص"
                          : <>اشتراك شهري — ينتهي <span className="num">{status.payment.end_date}</span></>}
                    </p>
                  )}
                  {status?.kind === "none" && <p className="text-sm opacity-95 mt-1">⚠ لا يوجد اشتراك مسجل</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                <Button size="lg" variant="outline" className="font-bold" onClick={openRenew}>
                  <RefreshCw className="size-5 ml-1" /> {status?.kind === "none" ? "تسجيل اشتراك" : "تجديد الاشتراك"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="font-bold"
                  onClick={() => recordAttendance(selected)}
                  disabled={status?.kind === "active" && (status.expired || (status.remaining !== null && status.remaining <= 0))}
                >
                  <Check className="size-5 ml-1" /> تسجيل الحضور
                </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">إضافة عضو جديد</h3>
            {nextCode && <Badge className="num text-base px-3 py-1 bg-gold text-gold-foreground">الكود الجديد: #{nextCode}</Badge>}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم العميل</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="الاسم بالكامل" />
            </div>
            <div className="space-y-2">
              <Label>رقم الموبايل (اختياري)</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} dir="ltr" className="text-right num" />
            </div>
          </div>
          {newSub && <SubscriptionForm value={newSub} onChange={setNewSub} trainings={trainings} />}
          <Button onClick={addNewMember} className="w-full font-bold" size="lg">
            <UserPlus className="size-5 ml-1" /> إضافة وتسجيل الاشتراك
          </Button>
        </Card>
      )}

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg">سجل اليوم — {todayISO()}</h2>
          <Badge variant="secondary" className="num text-base">{today.length} حضور</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>التدريب</TableHead>
                <TableHead>وقت الحضور</TableHead>
                <TableHead>الانصراف</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {today.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا يوجد حضور اليوم بعد</TableCell></TableRow>
              )}
              {today.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="num text-gold font-bold">#{a.members?.code}</TableCell>
                  <TableCell className="font-semibold">{a.members?.name}</TableCell>
                  <TableCell><Badge variant="outline">{a.training_type}</Badge></TableCell>
                  <TableCell className="num">{new Date(a.checked_in_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell className="num">{a.checked_out_at ? new Date(a.checked_out_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                    {!a.checked_out_at && (
                      <Button size="sm" variant="ghost" onClick={() => checkOut(a.id)}>
                        <LogOutIcon className="size-4 ml-1" /> انصراف
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAttendance(a.id, a.members?.name)} aria-label="حذف">
                      <Trash2 className="size-4" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>تجديد اشتراك {selected?.name} • #{selected?.code}</DialogTitle></DialogHeader>
          {renewSub && <SubscriptionForm value={renewSub} onChange={setRenewSub} trainings={trainings} />}
          <DialogFooter>
            <Button onClick={doRenew} className="font-bold w-full"><RefreshCw className="size-4 ml-1" /> حفظ التجديد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
