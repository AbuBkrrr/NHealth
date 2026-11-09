import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@nhealth/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src/index.ts'), '@nhealth/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts') } },
  test: { environment: 'node', setupFiles: ['./test/setup.ts'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
});
