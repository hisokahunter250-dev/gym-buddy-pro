import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, LogOut, UserCheck, Users, BarChart3, Wallet, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

type NavItem = { to: string; label: string; icon: typeof UserCheck; adminOnly?: boolean };
const NAV: NavItem[] = [
  { to: "/attendance", label: "الحضور", icon: UserCheck },
  { to: "/members", label: "الأعضاء", icon: Users },
  { to: "/stats", label: "إحصائيات", icon: BarChart3 },
  { to: "/finance", label: "المالية", icon: Wallet },
  { to: "/settings", label: "الإعدادات", icon: SettingsIcon, adminOnly: true },
];

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profileName, setProfileName] = useState("");

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    supabase.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfileName(data?.display_name || data?.username || "");
    });
  }, [user.id]);

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-sidebar/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl gradient-hero flex items-center justify-center shadow-glow">
              <Dumbbell className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-black leading-tight">نظام إدارة الجيم</h1>
              <p className="text-xs text-muted-foreground">{profileName} {isAdmin && <span className="text-gold font-bold">• مدير</span>}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4 ml-1" /> خروج
          </Button>
        </div>
        <nav className="container mx-auto px-2 flex gap-1 overflow-x-auto">
          {NAV.filter(n => !n.adminOnly || isAdmin).map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />{n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
