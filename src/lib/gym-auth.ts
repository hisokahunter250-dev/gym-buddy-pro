// Helper to use username-based auth on top of Supabase Auth
import { supabase } from "@/integrations/supabase/client";

const EMAIL_DOMAIN = "@gym.local";

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}${EMAIL_DOMAIN}`;

export async function signInWithUsername(username: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
}

export async function signUpWithUsername(username: string, password: string, displayName?: string) {
  return supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: { username: username.trim(), display_name: displayName ?? username.trim() },
      emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
}
