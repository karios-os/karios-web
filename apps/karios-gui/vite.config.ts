import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig(({ mode }) => {
  const workspaceRoot = process.cwd();
  const appRoot = path.join(workspaceRoot, 'apps/karios-gui');

  // Runtime configuration is now handled via config.js - no need for build-time env vars

  const base = '/';

  return {
    base,
    root: appRoot,
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: {
        '@karios-monorepo/shared-state': path.resolve(
          workspaceRoot,
          'libs/shared-state/src/index.ts'
        ),
        '@karios-monorepo/feature-admin': path.resolve(
          workspaceRoot,
          'libs/feature-admin/src/index.ts'
        ),
        '@karios-monorepo/feature-auth': path.resolve(
          workspaceRoot,
          'libs/feature-auth/src/index.ts'
        ),
        '@karios-monorepo/feature-vm': path.resolve(workspaceRoot, 'libs/feature-vm/src/index.ts'),
        '@karios-monorepo/feature-server': path.resolve(
          workspaceRoot,
          'libs/feature-server/src/index.ts'
        ),
        '@karios-monorepo/feature-datacenter': path.resolve(
          workspaceRoot,
          'libs/feature-datacenter/src/index.ts'
        ),
        '@karios-monorepo/feature-navigation': path.resolve(
          workspaceRoot,
          'libs/feature-navigation/src/index.ts'
        ),
        '@karios-monorepo/shared-ui': path.resolve(workspaceRoot, 'libs/shared-ui/src/index.ts'),
        '@karios-monorepo/feature-vnc': path.resolve(
          workspaceRoot,
          'libs/feature-vnc/src/index.ts'
        ),
      },
    },
    server: {
      headers: {
        'Permissions-Policy': 'fullscreen=*',
      },
      // proxy: {
      //   // Main API proxy to json-server
      //   "/api/v1/user/login": {
      //     target: `http://${mockServerIp}:${mockServerPort}/login`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/user\/login/, ""),
      //   },
      //   "/api/v1/user/register": {
      //     target: `http://${mockServerIp}:${mockServerPort}/register`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/user\/register/, ""),
      //   },
      //   "/api/v1/users": {
      //     target: `http://${mockServerIp}:${mockServerPort}/users`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/users/, ""),
      //   },
      //   "/api/v1/compute/vms/list": {
      //     target: `http://${mockServerIp}:${mockServerPort}/vms`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/compute\/vms\/list/, ""),
      //   },
      //   "/api/v1/network/drivers": {
      //     target: `http://${mockServerIp}:${mockServerPort}/drivers`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/network\/drivers/, ""),
      //   },
      //   "/api/v1/network/switches": {
      //     target: `http://${mockServerIp}:${mockServerPort}/switches`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/network\/switches/, ""),
      //   },
      //   "/api/v1/storage/zfs/pools": {
      //     target: `http://${mockServerIp}:${mockServerPort}/pools`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/storage\/zfs\/pools/, ""),
      //   },
      //   "/api/v1/compute/vms/nodeinfo": {
      //     target: `http://${mockServerIp}:${mockServerPort}/nodeinfo`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/compute\/vms\/nodeinfo/, ""),
      //   },
      //   "/api/v1/compute/vms/provision": {
      //     target: `http://${mockServerIp}:${mockServerPort}/provision`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/compute\/vms\/provision/, ""),
      //   },
      //   "/api/v1/controlnode/scan": {
      //     target: `http://${mockServerIp}:${mockServerPort}/scan`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/controlnode\/scan/, ""),
      //   },
      //   "/api/v1/controlnode/inventory": {
      //     target: `http://${mockServerIp}:${mockServerPort}/inventory`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/controlnode\/inventory/, ""),
      //   },
      //   "/api/v1/controlnode/setbmccreds": {
      //     target: `http://${mockServerIp}:${mockServerPort}/setbmccreds`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1\/controlnode\/setbmccreds/, ""),
      //   },
      //   // Catch-all for other /api/v1 routes to a generic ok response or specific mock
      //   "/api/v1": {
      //     target: `http://${mockServerIp}:${mockServerPort}/ok_response`,
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (p) => p.replace(/^\/api\/v1/, ""),
      //   },
      //   // Keep other proxies if they are for different services and ports, or comment out if not needed for mock
      //   // "/logs-api": { ... },
      //   // "/server-metrics1": { ... },
      //   // "/server-metrics2": { ... },
      //   // "/vnc-console-api": { ... },
      //   // "/fs": { ... },
      // },
      fs: {
        allow: [
          path.resolve(workspaceRoot, 'apps/karios-gui'),
          path.resolve(workspaceRoot, 'node_modules'),
        ],
      },
    },
    define: {
      global: 'globalThis',
      'process.env': {},
    },
    optimizeDeps: {
      include: ['crypto-js'],
    },
  };
});
