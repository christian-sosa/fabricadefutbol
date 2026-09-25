import { z } from "zod";

export function supportsMatchExtras(modality: string) {
  return modality === "9v9" || modality === "10v10" || modality === "11v11";
}

export const matchScorersSchema = z.array(z.object({
  participantId: z.string().min(1).max(100),
  goals: z.number().int().positive().max(999)
}).strict()).max(100).superRefine((scorers, context) => {
  if (new Set(scorers.map((scorer) => scorer.participantId)).size !== scorers.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Cada goleador debe aparecer una sola vez." });
  }
});
