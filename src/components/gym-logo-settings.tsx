import { useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GymLogo } from "@/components/gym-logo";
import { GYM_LOGO_BUCKET } from "@/lib/gym-logo";
import { supabase } from "@/integrations/supabase/client";

export function GymLogoSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension) return toast.error("اختر صورة PNG أو JPG أو WebP");
    if (file.size > 5 * 1024 * 1024) return toast.error("حجم الشعار لا يتجاوز 5 ميجابايت");
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const path = `logos/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(GYM_LOGO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("app_settings").upsert({ key: "gym_logo", value: path, updated_at: new Date().toISOString() });
      if (error) {
        await supabase.storage.from(GYM_LOGO_BUCKET).remove([path]);
        throw error;
      }
      await qc.invalidateQueries({ queryKey: ["gym-logo"] });
      toast.success("تم حفظ شعار الجيم");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر رفع الشعار، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div className="flex items-center gap-2">
        <ImagePlus className="size-5 text-primary" />
        <h3 className="font-black text-lg">شعار الجيم</h3>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <GymLogo className="size-28 shrink-0 rounded-lg border border-border object-contain bg-muted" />
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="اختيار شعار الجيم" className="hidden" onChange={upload} disabled={busy} />
          <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />{busy ? "جاري رفع الشعار..." : "رفع شعار الجيم"}
          </Button>
          <p className="text-xs text-muted-foreground">PNG، JPG، WebP · حتى 5 ميجابايت</p>
        </div>
      </div>
    </div>
  );
}