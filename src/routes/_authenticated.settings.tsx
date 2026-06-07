import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import type { TrainingType } from "@/lib/gym-types";
import { signUpWithUsername } from "@/lib/gym-auth";

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
    <Tabs defaultValue="training" className="space-y-4">
      <TabsList>
        <TabsTrigger value="training">أنواع التدريب</TabsTrigger>
        <TabsTrigger value="users">المستخدمون</TabsTrigger>
        <TabsTrigger value="security">كلمة سر المالية</TabsTrigger>
      </TabsList>
      <TabsContent value="training"><TrainingTypesPanel /></TabsContent>
      <TabsContent value="users"><UsersPanel /></TabsContent>
      <TabsContent value="security"><FinancePasswordPanel /></TabsContent>
    </Tabs>
  );
}

function TrainingTypesPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: types = [] } = useQuery({
    queryKey: ["training_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_types").select("*").order("sort_order");
      if (error) throw error;
      return data as TrainingType[];
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("training_types").insert({ name: name.trim(), sort_order: types.length + 1 });
    if (error) return toast.error(error.message);
    setName(""); toast.success("تمت الإضافة"); qc.invalidateQueries({ queryKey: ["training_types"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("training_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["training_types"] });
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-black text-lg">أنواع التدريب</h3>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: كارديو" />
        <Button onClick={add}><Plus className="size-4 ml-1" />إضافة</Button>
      </div>
      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <span className="font-semibold">{t.name}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </Card>
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
    // Save current session so we can restore after signUp (which auto-signs in new user)
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
      <p className="text-xs text-muted-foreground">الموظفون يمكنهم تسجيل الحضور وإضافة الأعضاء فقط — لا يستطيعون تعديل أنواع التدريب أو الإعدادات.</p>
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
