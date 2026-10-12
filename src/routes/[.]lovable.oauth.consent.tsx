import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({ meta: [{ title: "موافقة ربط التطبيقات - إدارة الجيم" }, { name: "description", content: "مراجعة طلب ربط تطبيق خارجي بحساب الجيم." }, { property: "og:title", content: "موافقة ربط التطبيقات - إدارة الجيم" }, { property: "og:description", content: "مراجعة طلب ربط تطبيق خارجي بحساب الجيم." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-4 text-center">
      <p className="text-muted-foreground">تعذّر تحميل طلب الربط: {String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "تطبيق خارجي";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("لم يُرجع سيرفر المصادقة رابط إعادة توجيه.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-4">
        <h1 className="text-xl font-black">ربط {clientName} بحسابك</h1>
        <p className="text-sm text-muted-foreground">
          سيتمكن {clientName} من قراءة بيانات الجيم (الأعضاء، الحضور، الاشتراكات) وتسجيل الحضور نيابةً عنك.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
            موافقة
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
            رفض
          </Button>
        </div>
      </Card>
    </main>
  );
}
