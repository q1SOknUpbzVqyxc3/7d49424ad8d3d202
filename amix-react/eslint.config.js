import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'src/legacy'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: {
      'react-hooks': reactHooks,
      react,
      'react-refresh': reactRefresh
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' }
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react/jsx-uses-vars': 'error',
      ...reactRefresh.configs.vite.rules
    }
  }
]
