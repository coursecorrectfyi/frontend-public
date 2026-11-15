import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Generated output. `next lint` skipped these implicitly; the ESLint CLI needs them listed.
  { ignores: [".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // See src/conventions.test.ts: the barrel loads ~2,000 icon modules in dev tools and tests.
      "no-restricted-imports": ["error", {
        paths: [{ name: "@mui/icons-material", message: "Import icons by path: import SearchIcon from '@mui/icons-material/Search'" }],
      }],
    },
  },
];

export default eslintConfig;
