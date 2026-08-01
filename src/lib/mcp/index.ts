import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMembers from "./tools/list-members";
import getMember from "./tools/get-member";
import listAttendance from "./tools/list-attendance";
import listTrainingTypes from "./tools/list-training-types";
import financeSummary from "./tools/finance-summary";
import checkInMember from "./tools/check-in-member";

// The OAuth issuer must be the direct Supabase host; only the project ref
// survives publish unchanged, and Vite inlines this literal at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gym-buddy-pro",
  title: "Gym Buddy Pro",
  version: "0.1.0",
  instructions:
    "Tools for the Gym Buddy Pro attendance system. Read members, attendance logs, training plans and monthly revenue, and record a check-in. Look up members by their numeric code.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMembers, getMember, listAttendance, listTrainingTypes, financeSummary, checkInMember],
});
