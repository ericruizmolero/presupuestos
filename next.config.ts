import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/firestore', '@firebase/storage', '@firebase/app'],
  async redirects() {
    return [
      // Legacy /p/[slug] → /client/[slug]
      { source: '/p/:slug', destination: '/client/:slug', permanent: true },
      // Legacy /horas/[slug] → /h/[slug] (URL neutra para ES/EN)
      { source: '/horas/:slug', destination: '/h/:slug', permanent: true },
      // Cuestionarios: /q/ era la ruta corta inicial
      { source: '/q/:slug', destination: '/cuestionario/:slug', permanent: true },
      // Migración a Savvia: todo lo del dominio antiguo (presupuestos, horas, panel) va al nuevo
      // conservando la ruta. /api queda fuera: el conector MCP de Claude no sigue redirecciones.
      {
        source: '/:path((?!api/).*)',
        has: [{ type: 'host', value: 'client.treseiscero.app' }],
        destination: 'https://client.savvia.studio/:path',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
