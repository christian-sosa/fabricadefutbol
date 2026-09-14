import { isNextRedirectError } from "@/lib/next-redirect";

export type FormActionResult = { error: string | null };

// Compatibility for existing actions: only their own error redirect becomes inline state.
// Authentication and successful navigation must keep propagating to Next.js.
export async function formActionResult(action: (data: FormData) => Promise<unknown>, formData: FormData, errorPath: string): Promise<FormActionResult> {
  try {
    await action(formData);
    return { error: null };
  } catch (error) {
    if (isNextRedirectError(error)) {
      const digest = (error as { digest: string }).digest;
      const destination = digest.split(";").slice(2, -2).join(";");
      const url = new URL(destination, "https://local.invalid");
      const message = url.searchParams.get("error");
      if (url.origin === "https://local.invalid" && url.pathname === errorPath && message) return { error: message };
    }
    throw error;
  }
}
