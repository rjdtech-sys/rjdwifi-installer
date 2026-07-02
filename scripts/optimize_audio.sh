
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
  