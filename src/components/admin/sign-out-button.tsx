import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export function SignOutButton() {
  async function signOut() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <form action={signOut}>
      <Button className="w-full sm:w-auto" variant="ghost">
        Cerrar sesión
      </Button>
    </form>
  );
}
