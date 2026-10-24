import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // URLs de la versión anterior (Express + HTML) para no romper enlaces guardados
  async redirects() {
    return [
      { source: "/", destination: "/cotizaciones/nueva", permanent: false },
      {
        source: "/index.html",
        has: [{ type: "query", key: "id", value: "(?<id>.+)" }],
        destination: "/cotizaciones/:id",
        permanent: true,
      },
      { source: "/index.html", destination: "/cotizaciones/nueva", permanent: true },
      { source: "/cotizaciones.html", destination: "/cotizaciones", permanent: true },
    ];
  },
};

export default nextConfig;
