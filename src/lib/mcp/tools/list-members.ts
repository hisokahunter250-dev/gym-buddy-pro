import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_members",
  title: "قائمة الأعضاء / List members",
  description: "List gym members, optionally filtered by name or member code.",
  inputSchema: {
    search: z.string().optional().describe("Filter by member name or code."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("members")
      .select("id, code, name, phone, created_at")
      .order("code", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));

    if (search?.trim()) {
      const term = search.trim();
      const asCode = Number(term);
      query = Number.isFinite(asCode) && term !== ""
        ? query.eq("code", asCode)
        : query.ilike("name", `%${term}%`);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { members: data ?? [] },
    };
  },
});
