/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Для Railway
  output: 'standalone',
  // Для работы с Telegram webhook
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

module.exports = nextConfig
