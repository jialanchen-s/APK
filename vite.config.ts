import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = __dirname;
const backendTarget = `http://localhost:${process.env.SERVER_PORT || '3000'}`;

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    // 入口 HTML 在 client/ 下，把 root 设到 client 才能让产物直接落在 dist/client/index.html，
    // 与 server/main.ts 的 setBaseViewsDir('dist/client') 对齐。
    root: path.resolve(rootDir, 'client'),
    envDir: rootDir,
    base: '/',
    clearScreen: false,

    plugins: [react()],

    resolve: {
      alias: [
        { find: '@client', replacement: path.resolve(rootDir, 'client') },
        { find: '@shared', replacement: path.resolve(rootDir, 'shared') },
        { find: '@', replacement: path.resolve(rootDir, 'client/src') },
      ],
    },

    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
      'process.env.CLIENT_BASE_PATH': JSON.stringify(''),
    },

    server: {
      port: Number(process.env.CLIENT_DEV_PORT) || 8080,
      host: process.env.CLIENT_DEV_HOST || 'localhost',
      strictPort: true,
      // client 之外还要读 shared/，必须显式放行仓库根目录
      fs: { allow: [rootDir] },
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
      },
    },

    build: {
      outDir: path.resolve(rootDir, 'dist/client'),
      emptyOutDir: true,
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      chunkSizeWarningLimit: 800,
    },
  };
});
