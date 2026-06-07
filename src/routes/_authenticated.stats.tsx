import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X } from "lucide-react";
import type { Member, AttendanceRow } from "@/lib/gym-types";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "إحصائيات الحضور - الجيم" }] }),
  component: StatsPage,
});

function StatsPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isAll = ["الكل", "الجميع", "all", "*"].includes(search.trim().toLowerCase());

  const { data: matches = [] } = useQuery({
    queryKey: ["members-search-stats", search],
    queryFn: async () => {
      if (!search.trim() || isAll) return [];
      const isNum = /^\d+$/.test(search.trim());
      const q = supabase.from("members").select("*").limit(10);
      const { data } = isNum ? await q.eq("code", Number(search)) : await q.ilike("name", `${search}%`);
      return (data ?? []) as Member[];
    },
    enabled: search.trim().length > 0 && !isAll,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = matches.find(m => m.id === selectedId) ?? matches[0];

  // History for selected member
  const { data: memberHistory = [] } = useQuery({
    queryKey: ["member-attendance", selected?.id, from, to],
    queryFn: async () => {
      if (!selected) return [];
      let q = supabase.from("attendance").select("*").eq("member_id", selected.id).order("checked_in_at", { ascending: false }).limit(500);
      if (from) q = q.gte("attendance_date", from);
      if (to) q = q.lte("attendance_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
    enabled: !!selected,
  });

  // All-data view
  const { data: allData = [] } = useQuery({
    queryKey: ["all-attendance", from, to],
    queryFn: async () => {
      let q = supabase.from("attendance").select("*, members(code, name)").order("checked_in_at", { ascending: false }).limit(1000);
      if (from) q = q.gte("attendance_date", from);
      if (to) q = q.lte("attendance_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
    enabled: isAll,
  });

  const { data: weekStats = [] } = useQuery({
    queryKey: ["week-attendance"],
    queryFn: async () => {
      const fromD = new Date(); fromD.setDate(fromD.getDate() - 6);
      const { data, error } = await supabase
        .from("attendance")
        .select("attendance_date")
        .gte("attendance_date", fromD.toISOString().slice(0, 10));
      if (error) throw error;
      const map = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        map.set(d.toISOString().slice(0, 10), 0);
      }
      for (const r of data ?? []) map.set(r.attendance_date, (map.get(r.attendance_date) ?? 0) + 1);
      return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
    },
  });

  const clear = () => { setSearch(""); setFrom(""); setTo(""); setSelectedId(null); };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-7 gap-3">
        {weekStats.map(s => (
          <Card key={s.date} className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric" })}</p>
            <p className="text-2xl font-black num text-primary mt-1">{s.count}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6 shadow-card space-y-4">
        <div className="grid md:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
          <div>
            <Label>بحث (كود، اسم، أو اكتب "الكل" لعرض كل الداتا)</Label>
            <div className="relative mt-1">
              <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }} className="pr-10" placeholder='اكتب الكود أو الاسم أو "الكل"' />
            </div>
          </div>
          <div>
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="num" />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="num" />
          </div>
          <Button variant="ghost" onClick={clear}><X className="size-4 ml-1" />مسح</Button>
        </div>

        {matches.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {matches.map(m => (
              <button key={m.id} onClick={() => setSelectedId(m.id)} className={`px-3 py-1 rounded-full border text-sm ${selected?.id === m.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                {m.name} <span className="num">#{m.code}</span>
              </button>
            ))}
          </div>
        )}

        {!isAll && selected && (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="text-xl font-black">{selected.name}</p>
                <p className="text-sm text-muted-foreground num">كود: #{selected.code} • موبايل: {selected.phone || "—"}</p>
              </div>
              <Badge className="text-lg num bg-gold text-gold-foreground px-4 py-2">{memberHistory.length} يوم حضور</Badge>
            </div>
            <HistoryTable rows={memberHistory} />
          </>
        )}

        {isAll && (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <p className="font-black">كل سجلات الحضور والانصراف</p>
              <Badge className="text-lg num bg-gold text-gold-foreground px-4 py-2">{allData.length} سجل</Badge>
            </div>
            <HistoryTable rows={allData} withMember />
          </>
        )}
      </Card>
    </div>
  );
}

function HistoryTable({ rows, withMember = false }: { rows: AttendanceRow[]; withMember?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {withMember && <TableHead>العضو</TableHead>}
            <TableHead>التاريخ</TableHead>
            <TableHead>اليوم</TableHead>
            <TableHead>الحضور</TableHead>
            <TableHead>الانصراف</TableHead>
            <TableHead>التدريب</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={withMember ? 6 : 5} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>}
          {rows.map(a => (
            <TableRow key={a.id}>
              {withMember && <TableCell className="font-semibold">{a.members?.name} <span className="num text-gold">#{a.members?.code}</span></TableCell>}
              <TableCell className="num">{a.attendance_date}</TableCell>
              <TableCell>{new Date(a.attendance_date).toLocaleDateString("ar-EG", { weekday: "long" })}</TableCell>
              <TableCell className="num">{new Date(a.checked_in_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</TableCell>
              <TableCell className="num">{a.checked_out_at ? new Date(a.checked_out_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
              <TableCell><Badge variant="outline">{a.training_type}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
