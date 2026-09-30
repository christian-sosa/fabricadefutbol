import type { FeedbackCategory } from "@/lib/feedback-email";

export type FeedbackValues = {
  fullName: string;
  email: string;
  category: FeedbackCategory;
  organization: string;
  message: string;
};

export type FeedbackState = {
  status: "idle" | "error" | "success";
  message: string | null;
  errors: Partial<Record<keyof FeedbackValues, string>>;
  values: FeedbackValues;
};
