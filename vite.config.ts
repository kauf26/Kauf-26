import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { isWebOAuthConfigured } from './shared/webOAuthEnv';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '3000';
  const webOAuthEnabled = isWebOAuthConfigured(env);

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_WEB_OAUTH_ENABLED': JSON.stringify(
        webOAuthEnabled ? 'true' : 'false'
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
    base: '/',
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxies /api to the Express server (PORT from .env, default 3000)
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              const url = req.url ?? '';
              const hint =
                url.startsWith('/api/auth/') && !webOAuthEnabled
                  ? 'Web OAuth is disabled in .env — auth API calls are skipped in the UI.'
                  : `Start the backend (npm run server) on port ${apiPort}.`;
              console.warn(`[vite] API proxy unavailable for ${url}: ${err.message}. ${hint}`);
              if (res && 'writeHead' in res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    message: 'Backend unavailable',
                    hint,
                  })
                );
              }
            });
          },
        },
      },
    },
  };
});
