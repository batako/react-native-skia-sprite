const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const jsdoc = require('eslint-plugin-jsdoc');
const prettier = require('eslint-plugin-prettier');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  jsdoc.configs['flat/recommended-error'],
  {
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
      'import/resolver': {
        node: {
          paths: ['.'],
        },
      },
    },
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'error',
      'jsdoc/check-param-names': [
        'error',
        {
          checkDestructured: false,
          allowExtraTrailingParamDocs: false,
        },
      ],
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-syntax': 'error',
      'jsdoc/no-bad-blocks': 'error',
      'jsdoc/require-description': 'off',
      'jsdoc/require-description-complete-sentence': 'off',
      'jsdoc/tag-lines': [
        'error',
        'any',
        {
          startLines: 0,
        },
      ],
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-name': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-check': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },
  {
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          printWidth: 100,
          tabWidth: 2,
          semi: true,
          trailingComma: 'all',
          arrowParens: 'always',
          endOfLine: 'lf',
        },
      ],
    },
  },
  eslintConfigPrettier,
]);
