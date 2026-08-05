// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno runtime code (npm:/jsr: specifiers, Deno globals) — a separate project from the
    // Expo app, linted by Supabase's own tooling rather than this config.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
]);
