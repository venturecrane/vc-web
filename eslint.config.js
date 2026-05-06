import { venturecraneEslintConfig } from '@venturecrane/eslint-config'
import eslintPluginAstro from 'eslint-plugin-astro'
import globals from 'globals'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default venturecraneEslintConfig({
  tsconfigRootDir,
  additional: [
    ...eslintPluginAstro.configs.recommended,
    {
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
    },
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/.wrangler/**',
        '**/.astro/**',
        '**/.claude/**',
      ],
    },
  ],
})
