"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function signOut() {
    if (submitting) return;
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button className="w-full sm:w-auto" disabled={submitting} onClick={signOut} type="button" variant="ghost">
      {submitting ? "Cerrando..." : "Cerrar sesion"}
    </Button>
  );
}
