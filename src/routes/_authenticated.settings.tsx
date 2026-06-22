import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, KeyRound, Save, Palette, Download, Upload, Database, Building2, Shield, ShieldOff, Lock } from "lucide-react";
import { toast } from "sonner";
import type { TrainingType } from "@/lib/gym-types";
import { signUpWithUsername } from "@/lib/gym-auth";
import { exportJSON, exportXLSX, importFromFile } from "@/lib/backup";
import { useRef } from "react";
import { useTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "الإعدادات - الجيم" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/attendance" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="general">عام</TabsTrigger>
        <TabsTrigger value="training">أنواع التدريب والأسعار</TabsTrigger>
        <TabsTrigger value="users">المستخدمون</TabsTrigger>
        <TabsTrigger value="security">كلمة سر المالية</TabsTrigger>
        <TabsTrigger value="theme">الستايل</TabsTrigger>
        <TabsTrigger value="backup">النسخ الاحتياطي</TabsTrigger>
      </TabsList>
      <TabsContent value="general"><GeneralPanel /></TabsContent>
      <TabsContent value="training"><TrainingTypesPanel /></TabsContent>
      <TabsContent value="users"><UsersPanel /></TabsContent>
      <TabsContent value="security"><FinancePasswordPanel /></TabsContent>
      <TabsContent value="theme"><ThemePanel /></TabsContent>
      <TabsContent value="backup"><BackupPanel /></TabsContent>
    </Tabs>
  );
}

function GeneralPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["gym-name-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "gym_name").maybeSingle();
      return data?.value ?? "نظام إدارة الجيم";
    },
  });
  useEffect(() => { if (data) setName(data); }, [data]);

  const save = async () => {
    if (!name.trim()) return toast.error("ادخل اسم الجيم");
    setLoading(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "gym_name", value: name.trim(), updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ اسم الجيم");
    qc.invalidateQueries({ queryKey: ["gym-name-setting"] });
    qc.invalidateQueries({ queryKey: ["gym-name"] });
  };

  return (
    <Card className="p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-primary" />
        <h3 className="font-black text-lg">اسم الجيم</h3>
      </div>
      <p className="text-sm text-muted-foreground">يظهر في أعلى الصفحات بدلاً من "نظام إدارة الجيم"</p>
      <div className="space-y-2">
        <Label>الاسم</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: جيم النصر" />
      </div>
      <Button onClick={save} disabled={loading} className="font-bold"><Save className="size-4 ml-1" />{loading ? "..." : "حفظ"}</Button>
    </Card>
  );
}

function BackupPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"json" | "xlsx" | "import" | null>(null);

  const doExport = async (type: "json" | "xlsx") => {
    setBusy(type);
    try {
      if (type === "json") await exportJSON(); else await exportXLSX();
      toast.success("تم تصدير النسخة الاحتياطية");
    } catch (e: any) {
      toast.error(e.message || "فشل التصدير");
    } finally { setBusy(null); }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm("سيتم استيراد البيانات وإضافتها/تحديثها في قاعدة البيانات. هل أنت متأكد؟")) {
      e.target.value = "";
      return;
    }
    setBusy("import");
    try {
      const res = await importFromFile(f);
      const total = res.reduce((s, r) => s + r.inserted, 0);
      toast.success(`تم استيراد ${total} سجل`);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || "فشل الاستيراد");
    } finally {
      setBusy(null);
      e.target.value = "";
    }
  };

  return (
    <Card className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-primary" />
        <h3 className="font-black text-lg">النسخ الاحتياطي</h3>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold">تصدير نسخة احتياطية</h4>
        <p className="text-sm text-muted-foreground">يتم تنزيل كل البيانات (الأعضاء، الحضور، المدفوعات، الإعدادات).</p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => doExport("xlsx")} disabled={!!busy} className="font-bold">
            <Download className="size-4 ml-1" />{busy === "xlsx" ? "..." : "تصدير Excel"}
          </Button>
          <Button onClick={() => doExport("json")} disabled={!!busy} variant="outline" className="font-bold">
            <Download className="size-4 ml-1" />{busy === "json" ? "..." : "تصدير JSON"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="font-bold">استيراد نسخة احتياطية</h4>
        <p className="text-sm text-muted-foreground">
          اختر ملف JSON أو Excel سبق تصديره. السجلات الموجودة بنفس المعرّف سيتم تحديثها، والجديدة ستُضاف.
        </p>
        <input ref={fileRef} type="file" accept=".json,.xlsx,.xls" className="hidden" onChange={onPick} />
        <Button onClick={() => fileRef.current?.click()} disabled={!!busy} variant="secondary" className="font-bold">
          <Upload className="size-4 ml-1" />{busy === "import" ? "جاري الاستيراد..." : "اختيار ملف للاستيراد"}
        </Button>
      </div>
    </Card>
  );
}

function TrainingTypesPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const { data: types = [] } = useQuery({
    queryKey: ["training_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_types").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as TrainingType[];
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("training_types").insert({
      name: name.trim(),
      sort_order: types.length + 1,
      price: Number(price) || 0,
    } as any);
    if (error) return toast.error(error.message);
    setName(""); setPrice("");
    toast.success("تمت الإضافة");
    qc.invalidateQueries({ queryKey: ["training_types"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("training_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["training_types"] });
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-black text-lg">أنواع التدريب والأسعار</h3>
      <div className="grid md:grid-cols-[1fr_180px_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم نوع التدريب (مثال: كارديو)" />
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر (ج.م)" className="num" />
        <Button onClick={add}><Plus className="size-4 ml-1" />إضافة</Button>
      </div>
      <div className="space-y-2">
        {types.map(t => <TrainingRow key={t.id} t={t} onChanged={() => qc.invalidateQueries({ queryKey: ["training_types"] })} onRemove={() => remove(t.id)} />)}
      </div>
    </Card>
  );
}

function TrainingRow({ t, onChanged, onRemove }: { t: TrainingType; onChanged: () => void; onRemove: () => void }) {
  const [price, setPrice] = useState(String(t.price ?? 0));
  const [saving, setSaving] = useState(false);
  useEffect(() => setPrice(String(t.price ?? 0)), [t.price]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("training_types").update({ price: Number(price) || 0 } as any).eq("id", t.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث السعر");
    onChanged();
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
      <span className="font-semibold flex-1">{t.name}</span>
      <div className="flex items-center gap-2">
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="num w-28" />
        <span className="text-xs text-muted-foreground">ج.م</span>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}><Save className="size-4 ml-1" />حفظ</Button>
        <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
      return (profiles ?? []).map(p => ({ ...p, role: roleMap.get(p.id) ?? "staff" }));
    },
  });

  const addUser = async () => {
    if (!username.trim() || !password.trim() || !displayName.trim()) return toast.error("املأ جميع الحقول");
    if (password.length < 6) return toast.error("كلمة المرور 6 أحرف على الأقل");
    setLoading(true);
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    const { error } = await signUpWithUsername(username, password, displayName);
    if (adminSession) {
      await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء المستخدم");
    setUsername(""); setDisplayName(""); setPassword("");
    qc.invalidateQueries({ queryKey: ["all-users"] });
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-black text-lg">المستخدمون</h3>
      <div className="grid md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label>الاسم</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>اسم المستخدم</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" className="text-right" pattern="[a-z0-9_]+" />
        </div>
        <div className="space-y-1">
          <Label>كلمة المرور</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" dir="ltr" className="text-right" />
        </div>
        <div className="flex items-end">
          <Button className="w-full font-bold" onClick={addUser} disabled={loading}><Plus className="size-4 ml-1" />إضافة موظف</Button>
        </div>
      </div>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="font-semibold">{u.display_name || u.username}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{u.username}</p>
            </div>
            <Badge className={u.role === "admin" ? "bg-gold text-gold-foreground" : ""}>{u.role === "admin" ? "مدير" : "موظف"}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FinancePasswordPanel() {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!pwd.trim()) return toast.error("ادخل كلمة المرور");
    setLoading(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "finance_password", value: pwd, updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ كلمة المرور");
    setPwd("");
  };

  return (
    <Card className="p-6 space-y-4 max-w-md">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-gold" />
        <h3 className="font-black text-lg">كلمة سر تبويب المالية</h3>
      </div>
      <p className="text-sm text-muted-foreground">يتم استخدامها لفتح تبويب الإحصائيات المالية</p>
      <div className="space-y-2">
        <Label>كلمة المرور الجديدة</Label>
        <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} dir="ltr" className="text-right num" />
      </div>
      <Button onClick={save} disabled={loading} className="font-bold">{loading ? "..." : "حفظ"}</Button>
    </Card>
  );
}

function ThemePanel() {
  const { theme, setTheme } = useTheme();
  const options: { id: Theme; label: string; desc: string; preview: string }[] = [
    { id: "dark", label: "غامق رياضي", desc: "أسود وأحمر وذهبي — الستايل الافتراضي", preview: "linear-gradient(135deg, oklch(0.14 0.01 30), oklch(0.58 0.22 25))" },
    { id: "light", label: "فاتح كلاسيكي", desc: "خلفية بيضاء وألوان واضحة", preview: "linear-gradient(135deg, oklch(0.99 0.005 80), oklch(0.55 0.22 25))" },
    { id: "modern", label: "مودرن", desc: "أزرق/بنفسجي عصري بخلفية فاتحة", preview: "linear-gradient(135deg, oklch(0.55 0.2 260), oklch(0.65 0.18 290))" },
  ];
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="size-5 text-primary" />
        <h3 className="font-black text-lg">ستايل الموقع</h3>
      </div>
      <p className="text-sm text-muted-foreground">اختر شكل الموقع المفضل لك. التغيير يتم فورًا ويُحفظ على الجهاز.</p>
      <div className="grid md:grid-cols-3 gap-3">
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            className={`p-4 rounded-xl border-2 text-right transition-all ${theme === o.id ? "border-primary shadow-glow" : "border-border hover:border-primary/50"}`}
          >
            <div className="h-20 rounded-lg mb-3" style={{ background: o.preview }} />
            <p className="font-black">{o.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
            {theme === o.id && <Badge className="mt-2">مُفعّل</Badge>}
          </button>
        ))}
      </div>
    </Card>
  );
}
