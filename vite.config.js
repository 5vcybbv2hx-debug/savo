import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// cache-bust: full dep cache wipe — force fresh re-bundle
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    // Force a single copy of React — prevents "Invalid hook call" / null useState
    // crashes caused by duplicate React instances across dep chunks.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Force react + react-dom into a single consistent pre-bundle pass so they
    // share one ?v= hash. Without this, partial re-bundles leave react at one
    // ?v= and react-dom at another → two React instances → null dispatcher.
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
    // Re-optimize deps from scratch on every server start. The dep cache had
    // two mixed ?v= generations (stale .vite/deps) → duplicate React. This
    // guarantees one consistent pre-bundle pass until the cache is cleaned.
    force: true,
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
  ]
});