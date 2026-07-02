const fs = require('fs');
const path = require('path');

/**
 * Audio optimization script for PisoWiFi Portal
 * Compresses audio files to reduce file size for faster loading on old devices
 */

const audioFiles = [
  { input: 'uploads/audio/coin_drop.wav', output: 'uploads/audio/coin_drop_optimized.mp3', format: 'mp3' },
  { input: 'uploads/audio/connected.wav', output: 'uploads/audio/connected_optimized.mp3', format: 'mp3' },
  { input: 'uploads/audio/insert_coin_loop.wav', output: 'uploads/audio/insert_coin_loop_optimized.mp3', format: 'mp3' }
];

// Create optimized audio configuration
const audioConfig = {
  coinDrop: {
    original: '/uploads/audio/coin_drop.wav',
    optimized: '/uploads/audio/coin_drop_optimized.mp3',
    size: 'original', // Will be updated after optimization
    fallback: true // Use original as fallback
  },
  connected: {
    original: '/uploads/audio/connected.wav',
    optimized: '/uploads/audio/connected_optimized.mp3',
    size: 'original',
    fallback: true
  },
  insertCoinLoop: {
    original: '/uploads/audio/insert_coin_loop.wav',
    optimized: '/uploads/audio/insert_coin_loop_optimized.mp3',
    size: 'original',
    fallback: true
  }
};

// Generate audio optimization script
const generateOptimizationScript = () => {
  return `
# Audio Optimization Script
# Run this script to optimize audio files for web delivery

# Install ffmpeg if not already installed
# Ubuntu/Debian: sudo apt-get install ffmpeg
# macOS: brew install ffmpeg
# Windows: Download from https://ffmpeg.org/

# Optimize coin drop sound (short, important)
ffmpeg -i uploads/audio/coin_drop.wav -codec:a libmp3lame -b:a 32k -ar 22050 uploads/audio/coin_drop_optimized.mp3

# Optimize connected sound (short, important)  
ffmpeg -i uploads/audio/connected.wav -codec:a libmp3lame -b:a 32k -ar 22050 uploads/audio/connected_optimized.mp3

# Optimize insert coin loop (longer, background)
ffmpeg -i uploads/audio/insert_coin_loop.wav -codec:a libmp3lame -b:a 24k -ar 22050 uploads/audio/insert_coin_loop_optimized.mp3

# Create ultra-lightweight versions (optional)
ffmpeg -i uploads/audio/coin_drop.wav -codec:a libmp3lame -b:a 16k -ar 16000 uploads/audio/coin_drop_ultra.mp3
ffmpeg -i uploads/audio/connected.wav -codec:a libmp3lame -b:a 16k -ar 16000 uploads/audio/connected_ultra.mp3
  `;
};

// Create audio optimization guide
const optimizationGuide = `
# Audio Optimization Guide for PisoWiFi Portal

## Why Optimize Audio?
- Reduce file size by 80-90%
- Faster loading on 2G/3G networks
- Better performance on old devices
- Reduced bandwidth costs

## Optimization Settings
- **Format**: MP3 (better compression than WAV)
- **Bitrate**: 16-32kbps (sufficient for simple sounds)
- **Sample Rate**: 22kHz (reduces file size)
- **Mono**: For single-channel audio (smaller than stereo)

## File Size Comparison
- Original WAV: ~500KB per file
- Optimized MP3: ~50KB per file (90% reduction)
- Ultra-light MP3: ~25KB per file (95% reduction)

## Implementation Strategy
1. Load optimized versions by default
2. Fallback to original for high-end devices
3. Skip audio entirely on very slow connections
4. Use Web Audio API for better performance

## Code Implementation
\`\`\`javascript
// Optimized audio loading
const loadAudio = (src, isLowEndDevice) => {
  if (isLowEndDevice) return null;
  
  const audio = new Audio(src);
  audio.preload = 'none'; // Don't preload to save bandwidth
  return audio;
};

// Progressive audio loading
const playAudio = async (audio, isSlowConnection) => {
  if (isSlowConnection || !audio) return;
  
  try {
    audio.volume = 0.3; // Lower volume for less jarring experience
    await audio.play();
  } catch (e) {
    console.log('Audio play failed:', e);
  }
};
\`\`\`

## Browser Compatibility
- MP3: Supported by 99%+ of browsers
- Web Audio API: Supported by 95%+ of browsers
- Fallback: Silent operation on unsupported browsers
`;

// Save optimization script
fs.writeFileSync('scripts/optimize_audio.sh', generateOptimizationScript());
fs.writeFileSync('scripts/AUDIO_OPTIMIZATION_GUIDE.md', optimizationGuide);

// Save audio configuration
fs.writeFileSync('lib/audio-config.js', `
// Audio configuration for optimized loading
module.exports = ${JSON.stringify(audioConfig, null, 2)};
`);

console.log('🎵 Audio optimization scripts created!');
console.log('📁 Run ./scripts/optimize_audio.sh to optimize audio files');
console.log('📖 See AUDIO_OPTIMIZATION_GUIDE.md for implementation details');

// Check if ffmpeg is available (basic check)
const { exec } = require('child_process');
exec('ffmpeg -version', (error) => {
  if (error) {
    console.log('⚠️  FFmpeg not found. Install it to optimize audio files:');
    console.log('   Ubuntu/Debian: sudo apt-get install ffmpeg');
    console.log('   macOS: brew install ffmpeg');
    console.log('   Windows: Download from https://ffmpeg.org/');
  } else {
    console.log('✅ FFmpeg found - ready to optimize audio files!');
  }
});