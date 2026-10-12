import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import formaLogo from "@/assets/forma-logo.png.asset.json";

// The asset proxy only exists on Lovable hosting; use its origin for portable copies.
export const DEFAULT_GYM_LOGO = `https://id-preview--8a7b84d4-a4f1-4409-a6a2-fa7b6f2fba37.lovable.app${formaLogo.url}`;
export const GYM_LOGO_BUCKET = "gym-branding";

export const gymLogoOptions = queryOptions({
  queryKey: ["gym-logo"],
  staleTime: 45 * 60 * 1000,
  refetchInterval: 45 * 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "gym_logo").maybeSingle();
    if (error) throw error;
    if (!data?.value) return DEFAULT_GYM_LOGO;
    const { data: image, error: imageError } = await supabase.storage.from(GYM_LOGO_BUCKET).createSignedUrl(data.value, 3600);
    if (imageError) throw imageError;
    return image.signedUrl;
  },
});