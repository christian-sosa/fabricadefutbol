function collectAllowedDevOrigins() {
  if (process.env.NODE_ENV === "production") return [];

  const rawValues = [
    process.env.NGROK_URL
  ].filter(Boolean);

  const hosts = new Set();
  for (const raw of rawValues) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).host);
    } catch {
      // Ignora valores invalidos de entorno.
    }
  }

  return Array.from(hosts);
}

const allowedDevOrigins = collectAllowedDevOrigins();

function buildSecurityHeaders() {
  const headers = [
    {
      key: "X-Content-Type-Options",
      value: "nosniff"
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin"
    },
    {
      key: "X-Frame-Options",
      value: "DENY"
    },
    {
      key: "Content-Security-Policy",
      value: "frame-ancestors 'none'"
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.supabase.co",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://vercel.live",
        "frame-src https://vercel.live",
        "form-action 'self' https://*.supabase.co",
        "report-uri /api/security/csp-report"
      ].join("; ")
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()"
    }
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload"
    });
  }

  return headers;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_TARGET_ENV:
      process.env.NEXT_PUBLIC_SUPABASE_TARGET_ENV || process.env.SUPABASE_TARGET_ENV ||
      (process.env.NODE_ENV === "production" ? "production" : "development")
  },
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders()
      }
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      ...(allowedDevOrigins.length ? { allowedOrigins: allowedDevOrigins } : {})
    }
  }
};

export default nextConfig;
