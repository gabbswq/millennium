import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'

const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) })
export default [
  { ignores: ['.next/**', 'node_modules/**', 'landing/**', 'payments-sandbox/**', 'supabase/**', '.millennium/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
