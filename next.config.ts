import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the workspace root; an unrelated package-lock.json in a parent directory
  // otherwise makes Turbopack guess wrong about where the project starts.
  turbopack: { root: path.resolve(__dirname) },

  /**
   * Static export. Grading runs entirely in the browser, so the Raspberry Pi
   * only ever serves files -- no Node runtime, no ARM native builds, and no CPU
   * cost on the Pi no matter how long the paper is.
   */
  output: 'export',
  images: { unoptimized: true },
  // Serve from a folder without rewrites: /report -> /report/index.html
  trailingSlash: true,
}

export default nextConfig
