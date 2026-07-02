
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
```javascript
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
```

## Browser Compatibility
- MP3: Supported by 99%+ of browsers
- Web Audio API: Supported by 95%+ of browsers
- Fallback: Silent operation on unsupported browsers
