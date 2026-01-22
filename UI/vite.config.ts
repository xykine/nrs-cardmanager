import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     exclude: ['lucide-react'],
//   },
// });


export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // needed for the Docker Container port mapping to work
    strictPort: true,
    port: 3000
  },
  preview: {
    port: 3000,
    // allowedHosts: ['payroll-ui', "acedpay.com", "acedpaydev.com"]
  },
  build: {
    outDir: 'dist',            // default is fine
  },
})