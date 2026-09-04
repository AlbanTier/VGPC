/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: 'images1.vinted.net' },
      { protocol: 'https', hostname: 'i.ebayimg.com' },
    ],
  },
};

export default nextConfig;
