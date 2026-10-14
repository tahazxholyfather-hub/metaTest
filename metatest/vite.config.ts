import { defineConfig, loadEnv } from 'vite'
import path from "path"
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function isLocalhost(value: string | undefined) {
  if (value == null || value.trim() === '') return true
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const localhost = isLocalhost(env.LOCALHOST ?? env.VITE_LOCALHOST)
  return {
    plugins: [
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
        }
      }
    }
  }
})
