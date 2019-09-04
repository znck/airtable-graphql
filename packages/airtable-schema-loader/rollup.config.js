import ts from 'rollup-plugin-typescript2'
import resolve from 'rollup-plugin-node-resolve'
import { dependencies } from './package.json'

export default {
  input: 'src/index.ts',
  output: {
    format: 'cjs',
    file: 'lib/index.js',
  },
  plugins: [ts(), resolve()],
  external: Object.keys(dependencies),
}
