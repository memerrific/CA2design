import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Short commit id shown under Settings > About. GitHub Actions sets GITHUB_SHA.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const commit = env.GITHUB_SHA?.slice(0, 7) ?? 'dev';

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(commit),
  },
});
