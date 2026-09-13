import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const supabase = await createSupabaseServerClient();
  const result = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
    : code ? await supabase.auth.exchangeCodeForSession(code) : null;
  const path = result && !result.error ? "/admin/reset-password" : "/admin/forgot-password?error=expired";
  return NextResponse.redirect(new URL(path, request.url));
}
