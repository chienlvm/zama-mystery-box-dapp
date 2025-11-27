import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

// Zama FHE SDK Configuration
// Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp#vite-configuration

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
          // CORS headers for SharedArrayBuffer (WASM threads)
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          
          // Fix WASM MIME type
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
          
          next();
        });
      },
    },
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      // Buffer polyfill for browser
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util',
      // Force keccak to use JS implementation (no native bindings)
      'keccak': 'keccak/js.js',
      // Force fetch-retry to use main entry (CJS)
      'fetch-retry': 'fetch-retry/index.js',
    },
    // Force browser field resolution for packages with both Node and browser versions
    mainFields: ['browser', 'module', 'main']
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
        NodeModulesPolyfillPlugin()
      ]
    },
    include: [
      'buffer',
      'keccak',
      'fetch-retry'
    ],
    exclude: [
      '@zama-fhe/relayer-sdk',
      '@zama-fhe/relayer-sdk/web'
    ]
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/keccak/, /node_modules/]
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  assetsInclude: ['**/*.wasm']
});