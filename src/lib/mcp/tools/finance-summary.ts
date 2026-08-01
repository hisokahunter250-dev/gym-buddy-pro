import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "finance_summary",
  title: "ملخص مالي / Finance summary",
  description:
    "Revenue summary for a month: number of subscriptions and total collected amount (month format YYYY-MM, defaults to current month).",
  inputSchema: { month: z.string().optional().describe("Month as YYYY-MM.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const now = new Date();
    const target = month?.trim() || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!/^\d{4}-\d{2}$/.test(target)) {
      return { content: [{ type: "text", text: "month must look like YYYY-MM" }], isError: true };
    }
    const [year, mon] = target.split("-").map(Number);
    const start = `${target}-01`;
    const endDate = new Date(Date.UTC(year, mon, 1));
    const end = endDate.toISOString().slice(0, 10);

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("payments")
      .select("amount, start_date")
      .gte("start_date", start)
      .lt("start_date", end);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const summary = {
      month: target,
      subscriptions: rows.length,
      total_amount: rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
