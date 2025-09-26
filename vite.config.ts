import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Build configuration
  build: {
    lib: {
      entry: resolve(__dirname, 'spa-framework-perfect.ts'),
      name: 'PerfectSPAFramework',
      fileName: (format) => `spa-framework-perfect.${format}.js`,
      formats: ['es', 'umd', 'iife']
    },
    rollupOptions: {
      output: {
        globals: {
          // External dependencies if any
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
      mangle: {
        keep_fnames: false,
        keep_classnames: false
      }
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'es2020',
    outDir: 'dist'
  },

  // Development server
  server: {
    port: 3006,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/sse': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        ws: true
      }
    }
  },

  // TypeScript configuration
  esbuild: {
    target: 'es2020',
    format: 'esm'
  },

  // Plugin configuration
  plugins: [
    // Add plugins as needed
  ],

  // Optimization
  optimizeDeps: {
    include: ['typescript']
  },

  // Define global constants
  define: {
    __DEV__: process.env.NODE_ENV !== 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
    __AI_CLAUDE__: process.env.CLAUDE_ENV === 'true',
    __AI_GEMINI__: !!process.env.GEMINI_API_KEY,
    __AI_HYBRID__: process.env.AI_COLLABORATION === 'true'
  },

  // CSS configuration
  css: {
    postcss: {
      plugins: [
        // Add PostCSS plugins as needed
      ]
    }
  }
});