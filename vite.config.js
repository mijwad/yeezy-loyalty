import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Code-splitting to reduce main bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - only frontend dependencies
          'vendor-core': ['zod'],

          // Feature-based chunks (will be loaded dynamically)
          'views-dashboard': [
            './src/views/dashboard/index.js',
            './src/views/dashboard/BarChartCard.js',
            './src/views/dashboard/CreditsCard.js',
            './src/views/dashboard/KPIsRow.js',
            './src/views/dashboard/VIPTableCard.js',
            './src/views/dashboard/HighlightsRow.js'
          ],
          'views-customers': [
            './src/views/customers/index.js'
          ],
          'views-campaigns': [
            './src/views/campaigns/index.js'
          ],
          'views-loyalty': [
            './src/views/loyalty/index.js'
          ],
          'views-settings': [
            './src/views/settings/loyaltySettings.js',
            './src/views/settings/metaAppReview.js'
          ],
          'views-billing': [
            './src/views/billing/index.js'
          ],
          'views-integrations': [
            './src/views/integrations/index.js'
          ],
          'views-other': [
            './src/views/other/index.js',
            './src/views/other/smartInsights.js'
          ],
          'views-admin': [
            './src/views/admin/superAdmin.js'
          ],
          'views-customer': [
            './src/views/customer/portal.js'
          ],
          'views-auth': [
            './src/views/auth/login.js'
          ],

          // Modals
          'modals-core': [
            './src/modals/index.js',
            './src/modals/AddPosModal.js',
            './src/modals/PetpoojaIntegrationModal.js',
            './src/modals/RegisterCustomerModal.js',
            './src/modals/CustomerDrawerModal.js',
            './src/modals/ChangePasswordModal.js',
            './src/modals/ActivationSuccessModal.js',
            './src/modals/AmountSpentModal.js',
            './src/modals/AutoRefillModal.js',
            './src/modals/RefillCreditsModal.js',
            './src/modals/WebhookDocsModal.js',
            './src/modals/YeezyBillModal.js'
          ],

          // Utils
          'utils-core': [
            './src/utils/toast.js',
            './src/utils/tooltip.js',
            './src/utils/exportCsv.js'
          ]
        },

        // Chunk file naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,

    // Enable minification
    minify: 'esbuild',

    // Source maps for production debugging
    sourcemap: true,

    // Exclude server-only and heavy dev dependencies
    commonjsOptions: {
      exclude: ['@electric-sql/pglite', 'pg', 'ioredis', '@supabase/supabase-js', 'bcryptjs', 'express', 'cookie-parser', 'cors', 'jsonwebtoken', 'dotenv']
    }
  },

  // Base path for deployment
  base: '/',

  // Optimize dependencies
  optimizeDeps: {
    include: ['zod'],
    exclude: ['@electric-sql/pglite']
  }
});