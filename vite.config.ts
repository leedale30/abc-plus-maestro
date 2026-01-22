import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        outDir: 'dist',
        minify: 'terser',
        rollupOptions: {
            output: {
                manualChunks: undefined
            }
        }
    },
    server: {
        port: 5173,
        open: true
    }
});
