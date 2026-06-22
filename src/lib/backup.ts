import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["members", "training_types", "attendance", "payments", "app_settings"] as const;
type TableName = typeof TABLES[number];

export type BackupData = {
  version: number;
  exported_at: string;
  tables: Record<string, any[]>;
};

export async function fetchAllData(): Promise<BackupData> {
  const tables: Record<string, any[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    tables[t] = data ?? [];
  }
  return { version: 1, exported_at: new Date().toISOString(), tables };
}

export async function exportJSON() {
  const data = await fetchAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  download(blob, `gym-backup-${stamp()}.json`);
}

export async function exportXLSX() {
  const data = await fetchAllData();
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(data.tables)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([buf], { type: "application/octet-stream" }), `gym-backup-${stamp()}.xlsx`);
}

export async function importFromFile(file: File): Promise<{ table: string; inserted: number; errors: number }[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let tables: Record<string, any[]>;
  if (ext === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    tables = parsed.tables ?? parsed;
  } else if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    tables = {};
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[name]);
      tables[name] = rows.filter(r => Object.keys(r).length > 0);
    }
  } else {
    throw new Error("صيغة غير مدعومة، استخدم JSON أو XLSX");
  }

  const order: TableName[] = ["app_settings", "training_types", "members", "payments", "attendance"];
  const results: { table: string; inserted: number; errors: number }[] = [];
  for (const t of order) {
    const rows = tables[t];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    // Clean nulls/empty values from xlsx
    const clean = rows.map(r => {
      const o: any = {};
      for (const k of Object.keys(r)) if (r[k] !== "" && r[k] !== undefined) o[k] = r[k];
      return o;
    });
    const { error } = await supabase.from(t).upsert(clean as any, { onConflict: "id" });
    results.push({ table: t, inserted: clean.length, errors: error ? clean.length : 0 });
    if (error) console.error(`Import ${t}:`, error);
  }
  return results;
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
