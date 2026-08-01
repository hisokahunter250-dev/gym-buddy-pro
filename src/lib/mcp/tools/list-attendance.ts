import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_attendance",
  title: "سجل الحضور / Attendance log",
  description:
    "List check-in/check-out records. Filter by date range (YYYY-MM-DD) and/or member code. Defaults to today.",
  inputSchema: {
    from: z.string().optional().describe("Start date YYYY-MM-DD."),
    to: z.string().optional().describe("End date YYYY-MM-DD."),
    member_code: z.number().int().optional().describe("Only this member's records."),
    limit: z.number().int().optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, member_code, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const start = from ?? today;
    const end = to ?? from ?? today;

    let memberId: string | undefined;
    if (typeof member_code === "number") {
      const { data: member, error } = await supabase
        .from("members")
        .select("id")
        .eq("code", member_code)
        .maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!member) return { content: [{ type: "text", text: `No member with code ${member_code}` }], isError: true };
      memberId = member.id;
    }

    let query = supabase
      .from("attendance")
      .select("id, attendance_date, training_type, checked_in_at, checked_out_at, members(code, name)")
      .gte("attendance_date", start)
      .lte("attendance_date", end)
      .order("checked_in_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 100, 1), 500));
    if (memberId) query = query.eq("member_id", memberId);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ from: start, to: end, rows: data ?? [] }) }],
      structuredContent: { from: start, to: end, rows: data ?? [] },
    };
  },
});
