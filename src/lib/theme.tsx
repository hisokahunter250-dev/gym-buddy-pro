import { useEffect, useState } from "react";

export type Theme = "dark" | "light" | "modern" | "forma";
const KEY = "gym-theme";

/** ستايل الموقع الافتراضي لما المستخدم ما يكونش اختار ستايل قبل كده */
export const DEFAULT_THEME: Theme = "forma";

const ALL: Theme[] = ["dark", "light", "modern", "forma"];

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(...ALL);
  html.classList.add(t);
  try { localStorage.setItem(KEY, t); } catch {}
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = localStorage.getItem(KEY) as Theme | null;
    if (v && (ALL as string[]).includes(v)) return v;
  } catch {}
  return DEFAULT_THEME;
}

export function ThemeApplier() {
  useEffect(() => { applyTheme(getStoredTheme()); }, []);
  return null;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  useEffect(() => { setTheme(getStoredTheme()); }, []);
  const change = (t: Theme) => { setTheme(t); applyTheme(t); };
  return { theme, setTheme: change };
}
