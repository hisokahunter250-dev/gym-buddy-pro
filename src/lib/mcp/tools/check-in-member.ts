import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "check_in_member",
  title: "تسجيل حضور / Check in member",
  description: "Record today's check-in for a member by code with the given training type.",
  inputSchema: {
    code: z.number().int().describe("Member code."),
    training_type: z.string().describe("Training plan name, e.g. from list_training_types."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ code, training_type }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, code, name")
      .eq("code", code)
      .maybeSingle();
    if (memberErr) return { content: [{ type: "text", text: memberErr.message }], isError: true };
    if (!member) return { content: [{ type: "text", text: `No member with code ${code}` }], isError: true };

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("member_id", member.id)
      .eq("attendance_date", today)
      .is("checked_out_at", null)
      .maybeSingle();
    if (existing) {
      return { content: [{ type: "text", text: `${member.name} is already checked in today.` }], isError: true };
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert({ member_id: member.id, training_type, attendance_date: today, recorded_by: ctx.getUserId() })
      .select("id, attendance_date, training_type, checked_in_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify({ member, attendance: data }) }],
      structuredContent: { member, attendance: data },
    };
  },
});
