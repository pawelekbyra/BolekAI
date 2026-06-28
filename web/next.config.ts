import type { NextConfig } from 'next'

const config: NextConfig = {
  env: {
    BOLEK_API_URL: process.env.BOLEK_API_URL ?? 'http://localhost:8787',
  },
}

export default config
