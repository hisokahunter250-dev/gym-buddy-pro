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
import { Search, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Member, Payment } from "@/lib/gym-types";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "الأعضاء - الجيم" }] }),
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
        </div>

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
                    <TableCell>
                      <RenewDialog member={m} onDone={() => qc.invalidateQueries()} />
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

function RenewDialog({ member, onDone }: { member: Member; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("ادخل المبلغ");
    setLoading(true);
    const m = Math.max(1, Number(months) || 1);
    const start = new Date();
    const end = new Date(start); end.setMonth(end.getMonth() + m);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      member_id: member.id,
      amount: Number(amount),
      duration_months: m,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      recorded_by: u.user?.id,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم التجديد");
    setOpen(false); setAmount(""); setMonths("1");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><RefreshCw className="size-4 ml-1" />تجديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تجديد اشتراك — {member.name} #{member.code}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>المبلغ (جنيه)</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" />
          </div>
          <div className="space-y-2">
            <Label>المدة (شهر)</Label>
            <Input type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} className="num" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} className="font-bold w-full">{loading ? "..." : "حفظ التجديد"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
