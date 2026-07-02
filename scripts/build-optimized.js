#!/usr/bin/env node

/**
 * Build Script for Optimized PisoWiFi Portal
 * Creates both standard and lightweight bundles for different device types
 */

const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

// Build configurations
const configs = [
  {
    name: 'Standard Bundle',
    entry: 'index.tsx',
    outfile: 'dist/bundle.js',
    format: 'esm',
    target: 'es2015',
    minify: true,
    sourcemap: true,
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' }
  },
  {
    name: 'Optimized Bundle',
    entry: 'index-optimized.tsx',
    outfile: 'dist/bundle-optimized.js',
    format: 'iife',
    target: 'es2015',
    minify: true,
    sourcemap: false,
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    // Remove heavy dependencies for old devices
    external: ['socket.io-client', 'recharts', 'lucide-react']
  }
];

async function buildAll() {
  console.log('🚀 Starting optimized build process...');
  
  for (const config of configs) {
    console.log(`\n📦 Building ${config.name}...`);
    
    try {
      const result = await build({
        entryPoints: [config.entry],
        bundle: true,
        outfile: config.outfile,
        format: config.format,
        target: config.target,
        minify: config.minify,
        sourcemap: config.sourcemap,
        loader: config.loader,
        jsx: config.jsx,
        define: config.define,
        external: config.external || [],
        logLevel: 'info'
      });
      
      // Get file size
      const stats = fs.statSync(config.outfile);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      console.log(`✅ ${config.name} completed: ${sizeKB}KB`);
      console.log(`📁 Output: ${config.outfile}`);
      
    } catch (error) {
      console.error(`❌ ${config.name} failed:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All builds completed successfully!');
  console.log('\n📊 Build Summary:');
  
  // Show build summary
  configs.forEach(config => {
    try {
      const stats = fs.statSync(config.outfile);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`   ${config.name}: ${sizeKB}KB`);
    } catch (error) {
      console.log(`   ${config.name}: Not found`);
    }
  });
  
  // Create build info file
  const buildInfo = {
    timestamp: new Date().toISOString(),
    builds: configs.map(config => ({
      name: config.name,
      file: config.outfile,
      size: fs.statSync(config.outfile).size,
      sizeKB: (fs.statSync(config.outfile).size / 1024).toFixed(1)
    }))
  };
  
  fs.writeFileSync('dist/build-info.json', JSON.stringify(buildInfo, null, 2));
  console.log('\n📋 Build info saved to: dist/build-info.json');
}

// Run the build
buildAll().catch(error => {
  console.error('Build process failed:', error);
  process.exit(1);
});