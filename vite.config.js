import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/ and from any folder.
export default defineConfig({ base: './', test: { include: ['tests/**/*.test.js'] } });
