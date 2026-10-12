import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const pick = (r: Record<string, any>, keys: string[]) => {
  for (const k of Object.keys(r)) {
    if (keys.includes(k.trim().toLowerCase())) return r[k];
  }
  return undefined;
};

export async function importMembersFromExcel(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
  const { data: existing } = await supabase.from("members").select("code");
  const used = new Set((existing ?? []).map((m) => m.code));
  let next = Math.max(0, ...used) + 1;
  const toInsert: { code: number; name: string; phone: string | null }[] = [];
  let skipped = 0;
  for (const r of rows) {
    const name = String(pick(r, ["name", "الاسم", "اسم", "اسم العضو"]) ?? "").trim();
    if (!name) { skipped++; continue; }
    let code = Number(pick(r, ["code", "الكود", "كود"]));
    if (!Number.isInteger(code) || code <= 0) {
      while (used.has(next)) next++;
      code = next;
    } else if (used.has(code)) { skipped++; continue; }
    used.add(code);
    const phone = pick(r, ["phone", "الموبايل", "الهاتف", "موبايل", "رقم الموبايل"]);
    toInsert.push({ code, name, phone: phone ? String(phone) : null });
  }
  if (toInsert.length) {
    const { error } = await supabase.from("members").insert(toInsert);
    if (error) throw error;
  }
  return { inserted: toInsert.length, skipped };
}
