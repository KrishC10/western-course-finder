import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from /western-course-finder/.
  base: '/western-course-finder/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
