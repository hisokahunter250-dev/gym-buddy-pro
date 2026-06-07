import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signInWithUsername, signUpWithUsername } from "@/lib/gym-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول - نظام الجيم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    // Check if any profile exists (to enable first-time admin signup)
    supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => {
      setHasUsers((count ?? 0) > 0);
    });
  }, [navigate]);

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await signInWithUsername(String(fd.get("username")), String(fd.get("password")));
    setLoading(false);
    if (error) return toast.error("بيانات الدخول غير صحيحة");
    toast.success("تم الدخول بنجاح");
    navigate({ to: "/app" });
  };

  const onSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username"));
    const password = String(fd.get("password"));
    const display = String(fd.get("display_name") || username);
    if (password.length < 6) { setLoading(false); return toast.error("كلمة المرور 6 أحرف على الأقل"); }
    const { error } = await signUpWithUsername(username, password, display);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء حساب المدير. سجل الدخول الآن");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card border-border/60">
        <div className="flex flex-col items-center mb-6">
          <div className="size-16 rounded-2xl gradient-hero flex items-center justify-center shadow-glow mb-4">
            <Dumbbell className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">نظام إدارة الجيم</h1>
          <p className="text-sm text-muted-foreground mt-1">سجل الدخول للمتابعة</p>
        </div>

        <Tabs defaultValue={hasUsers === false ? "signup" : "login"}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">دخول</TabsTrigger>
            <TabsTrigger value="signup" disabled={hasUsers === true}>
              {hasUsers === false ? "إنشاء حساب المدير" : "حساب جديد"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={onLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input id="username" name="username" required dir="ltr" className="text-right" autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input id="password" name="password" type="password" required dir="ltr" className="text-right" autoComplete="current-password" />
              </div>
              <Button type="submit" disabled={loading} className="w-full font-bold">
                {loading ? "..." : "دخول"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            {hasUsers === true ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                إنشاء الحسابات الجديدة من حساب المدير فقط
              </p>
            ) : (
              <form onSubmit={onSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-display">الاسم</Label>
                  <Input id="su-display" name="display_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-username">اسم المستخدم (إنجليزي)</Label>
                  <Input id="su-username" name="username" required dir="ltr" className="text-right" pattern="[a-z0-9_]+" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">كلمة المرور</Label>
                  <Input id="su-password" name="password" type="password" required minLength={6} dir="ltr" className="text-right" />
                </div>
                <Button type="submit" disabled={loading} className="w-full font-bold">
                  {loading ? "..." : "إنشاء الحساب"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  أول حساب يتم إنشاؤه يصبح المدير العام
                </p>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
