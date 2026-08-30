/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });

    if (isServer) {
      config.externals = [...config.externals, 'undici'];
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        undici: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;



