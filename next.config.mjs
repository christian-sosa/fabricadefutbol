function collectAllowedDevOrigins() {
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      ...(allowedDevOrigins.length ? { allowedOrigins: allowedDevOrigins } : {})
    }
  }
};

export default nextConfig;
