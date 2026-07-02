const { build } = require('esbuild');
require('dotenv').config();

const define = {
  'process.env.NODE_ENV': '"production"',
  'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
  'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
};

console.log('Building with environment variables:');
console.log('NODE_ENV:', define['process.env.NODE_ENV']);
console.log('SUPABASE_URL:', define['process.env.SUPABASE_URL'] ? 'Defined' : 'Undefined');
console.log('SUPABASE_ANON_KEY:', define['process.env.SUPABASE_ANON_KEY'] ? 'Defined' : 'Undefined');

build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  minify: true,
  sourcemap: true,
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  jsx: 'automatic',
  define,
}).then(() => {
  console.log('Build complete');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
