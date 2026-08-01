import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_member",
  title: "بيانات عضو / Member details",
  description:
    "Get one member by code, with their latest subscription (amount, dates, sessions) and attendance count.",
  inputSchema: { code: z.number().int().describe("The member code.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ code }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: member, error } = await supabase
      .from("members")
      .select("id, code, name, phone, created_at")
      .eq("code", code)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!member) return { content: [{ type: "text", text: `No member with code ${code}` }], isError: true };

    const [{ data: payment }, { count }] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, duration_months, start_date, end_date, sessions_total, notes, created_at")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("member_id", member.id),
    ]);

    const result = { member, latest_payment: payment ?? null, attendance_count: count ?? 0 };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
