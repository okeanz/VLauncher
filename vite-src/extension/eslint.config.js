import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,js}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
    rules: {
      // Node.js специфичные правила
      'no-console': 'off', // Разрешаем console.log в extension
      '@typescript-eslint/no-var-requires': 'off', // Разрешаем require в Node.js
    },
  },
)
