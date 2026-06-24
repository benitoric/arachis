/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["TU-PROYECTO.supabase.co"],
  },
  async redirects() {
    return [
      {
        source: '/pedido',
        destination: '/pedidos',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
