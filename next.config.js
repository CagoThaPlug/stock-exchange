/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Prevent bundling native onnxruntime-node binaries; we use web backends in the browser
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'onnxruntime-node': false,
      sharp: false,
    };
    return config;
  },
};

module.exports = nextConfig;
