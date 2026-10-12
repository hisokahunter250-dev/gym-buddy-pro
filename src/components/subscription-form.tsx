import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingType } from "@/lib/gym-types";

export type SubValues = {
  training: string;
  subType: "monthly" | "open";
  months: string;
  amount: string;
  discount: string;
  sessions: string;
};

export function defaultSub(trainings: TrainingType[], name?: string): SubValues {
  const t = trainings.find((x) => x.name === name) ?? trainings[0];
  return {
    training: t?.name ?? "",
    subType: "monthly",
    months: "1",
    amount: t ? String(t.price || "") : "",
    discount: "0",
    sessions: t ? String(t.sessions_count || 0) : "0",
  };
}

export function finalAmount(v: SubValues) {
  return Math.max(0, (Number(v.amount) || 0) - (Number(v.discount) || 0));
}

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function savePayment(memberId: string, v: SubValues) {
  const months = v.subType === "monthly" ? Math.max(1, Number(v.months) || 1) : 0;
  const start = new Date();
  const end = new Date(start);
  if (v.subType === "monthly") end.setMonth(end.getMonth() + months);
  else end.setFullYear(end.getFullYear() + 10);
  const { data: u } = await supabase.auth.getUser();
  const discount = Number(v.discount) || 0;
  return supabase.from("payments").insert({
    member_id: memberId,
    amount: finalAmount(v),
    discount,
    duration_months: months,
    start_date: localISO(start),
    end_date: localISO(end),
    notes: `${v.training}${v.subType === "open" ? " • اشتراك مفتوح" : ""}${discount > 0 ? ` • خصم ${discount}` : ""}`,
    sessions_total: Number(v.sessions) || 0,
    recorded_by: u.user?.id,
  } as any);
}

export function SubscriptionForm({
  value, onChange, trainings,
}: { value: SubValues; onChange: (v: SubValues) => void; trainings: TrainingType[] }) {
  const set = (p: Partial<SubValues>) => onChange({ ...value, ...p });
  const priceFor = (name: string, monthsStr: string, subType: string) => {
    const t = trainings.find((x) => x.name === name);
    const m = subType === "monthly" ? Math.max(1, Number(monthsStr) || 1) : 1;
    return t ? String((t.price || 0) * m) : value.amount;
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>نوع التدريب / الخطة</Label>
        <Select
          value={value.training}
          onValueChange={(name) => {
            const t = trainings.find((x) => x.name === name);
            set({ training: name, amount: priceFor(name, value.months, value.subType), sessions: String(t?.sessions_count || 0) });
          }}
        >
          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>
            {trainings.map((t) => (
              <SelectItem key={t.id} value={t.name}>{t.name} {t.price ? `— ${t.price} ج.م` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>نوع الاشتراك</Label>
        <RadioGroup
          value={value.subType}
          onValueChange={(s) => set({ subType: s as "monthly" | "open", amount: priceFor(value.training, value.months, s) })}
          className="flex gap-6 h-10 items-center"
        >
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="monthly" /> <span>شهري</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="open" /> <span>حر / مفتوح</span></label>
        </RadioGroup>
      </div>
      {value.subType === "monthly" && (
        <div className="space-y-2">
          <Label>المدة (عدد الأشهر)</Label>
          <Input type="number" min="1" value={value.months} className="num"
            onChange={(e) => set({ months: e.target.value, amount: priceFor(value.training, e.target.value, value.subType) })} />
        </div>
      )}
      <div className="space-y-2">
        <Label>عدد الحصص <span className="text-xs text-muted-foreground">(0 = غير محدود)</span></Label>
        <Input type="number" min="0" value={value.sessions} onChange={(e) => set({ sessions: e.target.value })} className="num" />
      </div>
      <div className="space-y-2">
        <Label>المبلغ (جنيه) <span className="text-xs text-muted-foreground">يمكن تعديله</span></Label>
        <Input type="number" min="0" value={value.amount} onChange={(e) => set({ amount: e.target.value })} className="num" />
      </div>
      <div className="space-y-2">
        <Label>الخصم (جنيه)</Label>
        <Input type="number" min="0" value={value.discount} onChange={(e) => set({ discount: e.target.value })} className="num" />
      </div>
      <div className="md:col-span-2 p-3 rounded-lg border border-border bg-muted/40 flex justify-between font-bold">
        <span>الإجمالي بعد الخصم</span>
        <span className="num text-gold">{finalAmount(value)} ج.م</span>
      </div>
    </div>
  );
}
