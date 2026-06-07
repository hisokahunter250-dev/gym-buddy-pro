// Shared types
export type Member = {
  id: string;
  code: number;
  name: string;
  phone: string | null;
  created_at: string;
};

export type TrainingType = {
  id: string;
  name: string;
  sort_order: number;
};

export type AttendanceRow = {
  id: string;
  member_id: string;
  training_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  attendance_date: string;
  members?: { code: number; name: string } | null;
};

export type Payment = {
  id: string;
  member_id: string;
  amount: number;
  duration_months: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
};
