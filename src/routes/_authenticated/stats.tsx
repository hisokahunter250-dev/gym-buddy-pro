import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import type { Member, AttendanceRow } from "@/lib/gym-types";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "إحصائيات الحضور - الجيم" }] }),
  component: StatsPage,
});

function StatsPage() {
  const [search, setSearch] = useState("");

  const { data: matches = [] } = useQuery({
    queryKey: ["members-search-stats", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const isNum = /^\d+$/.test(search.trim());
      const q = supabase.from("members").select("*").limit(10);
      const { data } = isNum ? await q.eq("code", Number(search)) : await q.ilike("name", `${search}%`);
      return (data ?? []) as Member[];
    },
    enabled: search.trim().length > 0,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = matches.find(m => m.id === selectedId) ?? matches[0];

  const { data: memberHistory = [] } = useQuery({
    queryKey: ["member-attendance", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase.from("attendance")
        .select("*")
        .eq("member_id", selected.id)
        .order("checked_in_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
    enabled: !!selected,
  });

  const { data: weekStats = [] } = useQuery({
    queryKey: ["week-attendance"],
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 6);
      const { data, error } = await supabase
        .from("attendance")
        .select("attendance_date")
        .gte("attendance_date", from.toISOString().slice(0, 10));
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
        <div>
          <Label>بحث بكود أو اسم العضو</Label>
          <div className="relative mt-1">
            <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }} className="pr-10" placeholder="اكتب الكود أو الاسم" />
          </div>
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

        {selected && (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="text-xl font-black">{selected.name}</p>
                <p className="text-sm text-muted-foreground num">كود: #{selected.code} • موبايل: {selected.phone || "—"}</p>
              </div>
              <Badge className="text-lg num bg-gold text-gold-foreground px-4 py-2">{memberHistory.length} يوم حضور</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>اليوم</TableHead>
                    <TableHead>وقت الحضور</TableHead>
                    <TableHead>الانصراف</TableHead>
                    <TableHead>نوع التدريب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberHistory.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد سجل حضور</TableCell></TableRow>}
                  {memberHistory.map(a => (
                    <TableRow key={a.id}>
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
          </>
        )}
      </Card>
    </div>
  );
}
