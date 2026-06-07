import { useEffect, useState } from "react";

export type Theme = "dark" | "light" | "modern";
const KEY = "gym-theme";

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("dark", "light", "modern");
  html.classList.add(t);
  try { localStorage.setItem(KEY, t); } catch {}
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(KEY) as Theme | null;
    if (v === "dark" || v === "light" || v === "modern") return v;
  } catch {}
  return "dark";
}

export function ThemeApplier() {
  useEffect(() => { applyTheme(getStoredTheme()); }, []);
  return null;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(getStoredTheme()); }, []);
  const change = (t: Theme) => { setTheme(t); applyTheme(t); };
  return { theme, setTheme: change };
}
