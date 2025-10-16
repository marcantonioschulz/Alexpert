import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const allowedHosts = (env.VITE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  const backendUrl = env.VITE_BACKEND_URL ?? 'http://localhost:4000';

  return {
    server: {
      host: env.VITE_HOST ?? '0.0.0.0',
      port: Number(env.VITE_PORT ?? 3000),
      allowedHosts,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true
        }
      }
    },
    plugins: [react()]
  };
});
