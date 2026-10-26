import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from "path"
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * replyQuality.js lives in the CommonJS backend package so Node require()
 * keeps working. The quiz UI imports normalizeAssistantText as a named ESM
 * export. Vite would otherwise serve module.exports unchanged and the
 * browser module graph fails to start.
 */
function exposeReplyQualityEsm(): Plugin {
  return {
    name: 'expose-reply-quality-esm',
    enforce: 'pre',
    transform(code, id) {
      const clean = id.split('?')[0].replace(/\\/g, '/')
      if (!clean.endsWith('/ai-teacher/services/replyQuality.js')) return null
      if (/\bexport\s+/.test(code)) return null
      const match = code.match(/module\.exports\s*=\s*\{([\s\S]*?)\}\s*;?\s*$/)
      if (!match || match.index == null) return null
      const names = [...new Set([...match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((item) => item[1]))]
      const body = code.slice(0, match.index).replace(/\s*$/, '\n')
      const exports = names.map((name) => `export { ${name} };`).join('\n')
      return { code: `${body}${exports}\n`, map: null }
    },
  }
}

function cleanFlag(value: string | undefined) {
  if (value == null) return undefined
  const cleaned = value.trim().replace(/^['"]|['"]$/g, '')
  return cleaned === '' ? undefined : cleaned
}

function isLocalhost(value: string | undefined) {
  if (value == null || value.trim() === '') return true
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  // Shell wins over the env file, so `LOCALHOST=false npm run build` is the cPanel build
  // even when metatest/.env is still the local copy.
  const localhost = isLocalhost(
    cleanFlag(process.env.LOCALHOST)
    ?? cleanFlag(process.env.VITE_LOCALHOST)
    ?? cleanFlag(env.LOCALHOST)
    ?? cleanFlag(env.VITE_LOCALHOST),
  )
  return {
    plugins: [
      exposeReplyQualityEsm(),
      react(),
      tailwindcss(),
    ],
    base: localhost ? '/' : '/app/',
    define: {
      'import.meta.env.VITE_LOCALHOST': JSON.stringify(localhost ? 'true' : 'false'),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          cookiePathRewrite: '/',
        },
        '/avatars': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/images': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      }
    }
  }
})
