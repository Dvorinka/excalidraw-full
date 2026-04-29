import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'dist-test/', '*.config.*', 'eslint.config.mjs', 'e2e/', 'playwright/'] },
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react: pluginReact },
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'react/react-in-jsx-scope': 'off',
    },
  }
);
