import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Wallet, Users as UsersIcon, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { Payment } from "@/lib/gym-types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "المالية - الجيم" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.rpc("verify_finance_password", { _password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("كلمة المرور غير صحيحة");
    setUnlocked(true);
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 max-w-sm w-full shadow-card">
          <div className="size-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-4">
            <Lock className="size-8 text-gold-foreground" />
          </div>
          <h2 className="font-black text-xl text-center mb-1">تبويب المالية</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">أدخل كلمة المرور للوصول للإحصائيات المالية</p>
          <form onSubmit={unlock} className="space-y-3">
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} dir="ltr" className="text-right num" autoFocus />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loading}>{loading ? "..." : "فتح"}</Button>
            <p className="text-xs text-muted-foreground text-center">الافتراضي: 1234 — يمكن تغييرها من الإعدادات</p>
          </form>
        </Card>
      </div>
    );
  }

  return <FinanceContent />;
}

function FinanceContent() {
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const { data: membersCount = 0 } = useQuery({
    queryKey: ["members-count"],
    queryFn: async () => {
      const { count } = await supabase.from("members").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = ym(now);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; subscriptions: number }>();
    // last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(ym(d), { month: d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" }), revenue: 0, subscriptions: 0 });
    }
    for (const p of payments) {
      const key = p.created_at.slice(0, 7);
      const entry = map.get(key);
      if (entry) { entry.revenue += Number(p.amount); entry.subscriptions += 1; }
    }
    return Array.from(map.values());
  }, [payments]);

  const currentMonthData = monthlyData[monthlyData.length - 1];
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label="مشتركو الشهر" value={currentMonthData?.subscriptions ?? 0} accent="primary" />
        <StatCard icon={Wallet} label="إيراد الشهر الحالي" value={currentMonthData?.revenue ?? 0} suffix=" ج.م" accent="gold" />
        <StatCard icon={UsersIcon} label="إجمالي الأعضاء" value={membersCount} accent="success" />
        <StatCard icon={TrendingUp} label="إجمالي الإيرادات" value={totalRevenue} suffix=" ج.م" accent="primary" />
      </div>

      <Card className="p-6 shadow-card">
        <h3 className="font-black text-lg mb-4">تحليل الإيرادات والمشتركين — آخر 6 شهور</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 30)" />
              <XAxis dataKey="month" stroke="oklch(0.7 0.02 60)" />
              <YAxis yAxisId="l" stroke="oklch(0.82 0.16 85)" />
              <YAxis yAxisId="r" orientation="right" stroke="oklch(0.65 0.22 25)" />
              <Tooltip contentStyle={{ background: "oklch(0.19 0.012 30)", border: "1px solid oklch(0.28 0.015 30)", borderRadius: 8 }} />
              <Legend />
              <Bar yAxisId="l" dataKey="revenue" name="الإيرادات (ج.م)" fill="oklch(0.82 0.16 85)" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="r" dataKey="subscriptions" name="عدد الاشتراكات" fill="oklch(0.65 0.22 25)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 shadow-card">
        <h3 className="font-black text-lg mb-4">آخر المدفوعات</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="text-right border-b border-border">
                <th className="py-2">التاريخ</th>
                <th>المبلغ</th>
                <th>المدة (شهر)</th>
                <th>نهاية الاشتراك</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 30).map(p => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="py-2 num">{p.created_at.slice(0, 10)}</td>
                  <td className="num font-bold text-gold">{Number(p.amount).toLocaleString("en-US")}</td>
                  <td className="num">{p.duration_months}</td>
                  <td className="num">{p.end_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, accent }: { icon: any; label: string; value: number; suffix?: string; accent: "primary" | "gold" | "success" }) {
  const colors = {
    primary: "text-primary bg-primary/10",
    gold: "text-gold bg-gold/10",
    success: "text-success bg-success/10",
  }[accent];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`size-10 rounded-xl flex items-center justify-center ${colors}`}><Icon className="size-5" /></div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-3xl font-black num">{Number(value).toLocaleString("en-US")}{suffix}</p>
    </Card>
  );
}
