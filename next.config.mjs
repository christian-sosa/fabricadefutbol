function collectAllowedDevOrigins() {
  if (process.env.NODE_ENV === "production") return [];

  const rawValues = [
    process.env.MERCADOPAGO_WEBHOOK_BASE_URL_DEV,
    process.env.MERCADOPAGO_WEBHOOK_BASE_URL,
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
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  async redirects() {
    return [
      {
        source: "/pricing",
        destination: "/help",
        permanent: true
      }
    ];
  },
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
      bodySizeLimit: "2mb",
      ...(allowedDevOrigins.length ? { allowedOrigins: allowedDevOrigins } : {})
    }
  }
};

export default nextConfig;
