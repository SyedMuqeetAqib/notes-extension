import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  basePath: "",
  trailingSlash: true,
  experimental: {
    // Disable inline scripts for Chrome extension compatibility
    inlineCss: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Optimize bundle splitting
  webpack: (config, { isServer, dev }) => {
    // Production-only optimizations
    if (!dev && !isServer) {
      // Enable minification
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }
    // Handle optional dependencies that may not be installed
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Handle optional OpenTelemetry dependencies
      "@opentelemetry/exporter-jaeger": false,
      "@genkit-ai/firebase": false,
    };

    // Tree-shaking optimizations
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
    }

    // Handle handlebars webpack compatibility
    config.module.rules.push({
      test: /node_modules\/handlebars/,
      use: "null-loader",
    });

    // Ignore require.extensions warnings for handlebars
    config.externals = config.externals || [];
    if (typeof config.externals === "function") {
      const originalExternals = config.externals;
      config.externals = (context: any, request: any, callback: any) => {
        if (request === "handlebars") {
          return callback(null, "commonjs handlebars");
        }
        return originalExternals(context, request, callback);
      };
    }

    return config;
  },
};

export default nextConfig;
