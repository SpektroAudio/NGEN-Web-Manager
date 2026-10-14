import { defineConfig, globalIgnores } from "eslint/config";
import vue from "eslint-plugin-vue";
import ts from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  // Generated / build output — never lint these
  globalIgnores([
    ".nuxt/**",
    ".output/**",
    ".data/**",
    ".nitro/**",
    ".cache/**",
    "dist/**",
    "node_modules/**",
    "wasm/target/**",
    // wasm
    "public/wasm/nsl_wasm/**",
  ]),

  ts.configs.recommended,

  ...vue.configs["flat/recommended"],
  {
    files: ["*.vue", "**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: {
          js: tsParser,
          ts: tsParser,
          "<template>": "espree",
        },
      },
    },
  },

  {
    rules: {
      "no-undef": "off",
      "vue/max-attributes-per-line": "off",
    },
  },
]);
