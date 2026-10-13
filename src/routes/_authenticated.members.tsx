import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, RefreshCw, Upload, List, Trash2 } from "lucide-react";
import { importMembersFromExcel } from "@/lib/import-members";
import { toast } from "sonner";
import type { Member, Payment, TrainingType } from "@/lib/gym-types";
import { savePayment, SubscriptionForm, defaultSub, finalAmount, type SubValues } from "@/components/subscription-form";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "الأعضاء - الجيم" }, { name: "description", content: "بيانات أعضاء الجيم واشتراكاتهم." }, { property: "og:title", content: "الأعضاء - الجيم" }, { property: "og:description", content: "بيانات أعضاء الجيم واشتراكاتهم." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members-list", search],
    queryFn: async () => {
      let q = supabase.from("members").select("*").order("code", { ascending: false }).limit(200);
      const s = search.trim();
      if (s) {
        if (/^\d+$/.test(s)) q = q.eq("code", Number(s));
        else q = q.ilike("name", `%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("end_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const latestByMember = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const p of payments) {
      const cur = map.get(p.member_id);
      if (!cur || p.end_date > cur.end_date) map.set(p.member_id, p);
    }
    return map;
  }, [payments]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-card">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[240px]">
            <Label>بحث (الكود أو الاسم)</Label>
            <div className="relative mt-1">
              <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" placeholder="ابحث..." />
            </div>
          </div>
          <label className="inline-flex">
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              try {
                const r = await importMembersFromExcel(f);
                toast.success(`تم استيراد ${r.inserted} عضو${r.skipped ? ` — تم تخطي ${r.skipped}` : ""}`);
                qc.invalidateQueries();
              } catch (err: any) { toast.error(err.message ?? "فشل الاستيراد"); }
            }} />
            <Button asChild variant="outline"><span className="cursor-pointer"><Upload className="size-4 ml-1" />استيراد من Excel</span></Button>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mb-3">الأعمدة: الكود، الاسم، الموبايل (الكود اختياري — يُنشأ تلقائياً إذا كان فارغاً، والأكواد المكررة تُتخطى).</p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الموبايل</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead>نهاية الاشتراك</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell></TableRow>}
              {!isLoading && members.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد أعضاء</TableCell></TableRow>}
              {members.map(m => {
                const pay = latestByMember.get(m.id);
                const active = pay && pay.end_date >= today;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="num text-gold font-bold">#{m.code}</TableCell>
                    <TableCell className="font-semibold">{m.name}</TableCell>
                    <TableCell className="num text-muted-foreground" dir="ltr">{m.phone || "—"}</TableCell>
                    <TableCell className="num text-muted-foreground">{new Date(m.created_at).toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell className="num">{pay?.end_date ?? "—"}</TableCell>
                    <TableCell>
                      {pay ? (
                        active ? <Badge className="bg-success text-success-foreground">نشط</Badge>
                               : <Badge variant="destructive">منتهي</Badge>
                      ) : <Badge variant="outline">بدون اشتراك</Badge>}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <RenewDialog member={m} onDone={() => qc.invalidateQueries()} />
                      <SubsDialog member={m} payments={payments} onDone={() => qc.invalidateQueries()} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function useTrainings() {
  return useQuery({
    queryKey: ["training-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_types").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as TrainingType[];
    },
  });
}

function RenewDialog({ member, onDone }: { member: Member; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: trainings = [] } = useTrainings();
  const [sub, setSub] = useState<SubValues | null>(null);
  const [loading, setLoading] = useState(false);

  const openDialog = (o: boolean) => {
    setOpen(o);
    if (o) setSub(defaultSub(trainings));
  };

  const submit = async () => {
    if (!sub) return;
    if (!sub.training) return toast.error("اختر الباقة");
    if (finalAmount(sub) <= 0 && !(Number(sub.amount) > 0)) return toast.error("ادخل المبلغ");
    setLoading(true);
    const { error } = await savePayment(member.id, sub);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم التجديد");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><RefreshCw className="size-4 ml-1" />تجديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>تجديد اشتراك — {member.name} #{member.code}</DialogTitle></DialogHeader>
        {sub && <SubscriptionForm value={sub} onChange={setSub} trainings={trainings} />}
        <DialogFooter>
          <Button onClick={submit} disabled={loading} className="font-bold w-full">{loading ? "..." : "حفظ التجديد"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubsDialog({ member, payments, onDone }: { member: Member; payments: Payment[]; onDone: () => void }) {
  const list = payments.filter((p) => p.member_id === member.id).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const remove = async (id: string) => {
    if (!confirm("متأكد إنك عايز تحذف الاشتراك ده؟")) return;
    const { error, count } = await supabase.from("payments").delete({ count: "exact" }).eq("id", id);
    if (error) return toast.error(error.message);
    if (!count) return toast.error("حذف الاشتراكات متاح للمدير فقط");
    toast.success("تم حذف الاشتراك");
    onDone();
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><List className="size-4 ml-1" />الاشتراكات</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>اشتراكات — {member.name} #{member.code}</DialogTitle></DialogHeader>
        {list.length === 0 ? <p className="text-muted-foreground text-center py-6">لا توجد اشتراكات</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>الباقة</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>المبلغ</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.notes || "—"}</TableCell>
                  <TableCell className="num">{p.start_date}</TableCell>
                  <TableCell className="num">{p.end_date}</TableCell>
                  <TableCell className="num">{p.amount} ج.م</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
