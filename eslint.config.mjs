import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'

const config = [
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      '.cache/**',
      'coverage/**',
      'dist/**',
      '**/dist/**',
      'fixflags-cli/dist/**',
      'node_modules/**',
      'output/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },

  ...tsPlugin.configs['flat/recommended'],
  {
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin,
    },
    rules: {
      ...nextPlugin.flatConfig.coreWebVitals.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      // Preserve the established hook checks while React Compiler remains disabled.
      'react-hooks/rules-of-hooks': reactHooksPlugin.configs.recommended.rules['react-hooks/rules-of-hooks'],
      'react-hooks/exhaustive-deps': reactHooksPlugin.configs.recommended.rules['react-hooks/exhaustive-deps'],
      ...jsxA11yPlugin.configs.recommended.rules,
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]

export default config
