import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  if (!isAdminArea) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (pathname.startsWith("/admin/login")) {
    if (!user) return response;
    const { data: admin } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();
    if (admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!user) {
    return redirectToLogin(request);
  }

  const { data: admin, error: adminError } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();
  if (adminError || !admin) {
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"]
};
