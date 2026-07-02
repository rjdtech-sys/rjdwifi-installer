const fs = require('fs');
const path = require('path');

// Helper to write WAV file
function writeWav(filename, samples, sampleRate = 44100) {
    const buffer = Buffer.alloc(44 + samples.length * 2);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples.length * 2, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels (Mono)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples.length * 2, 40);

    // Write samples
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7FFF, 44 + i * 2);
    }

    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated: ${filename}`);
}

// 1. Generate "Coin Drop" (Short Beep)
const coinDropDuration = 0.2; // seconds
const coinDropRate = 44100;
const coinDropSamples = new Float32Array(coinDropDuration * coinDropRate);
for (let i = 0; i < coinDropSamples.length; i++) {
    const t = i / coinDropRate;
    // Simple high pitch beep (1200Hz) with decay
    coinDropSamples[i] = Math.sin(2 * Math.PI * 1200 * t) * (1 - t / coinDropDuration);
}
writeWav('uploads/audio/coin_drop.wav', coinDropSamples);

// 2. Generate "Insert Coin" (Looping Arcade Style Beat)
const loopDuration = 4.0; // 4 seconds loop
const loopRate = 44100;
const loopSamples = new Float32Array(loopDuration * loopRate);
const tempo = 4; // beats per second

for (let i = 0; i < loopSamples.length; i++) {
    const t = i / loopRate;
    
    // Base line (Sine wave at 150Hz, pulsing)
    const base = Math.sin(2 * Math.PI * 150 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * tempo * t));
    
    // Melody (Arpeggio style)
    let melodyFreq = 440;
    if ((t % 1) < 0.25) melodyFreq = 440; // A4
    else if ((t % 1) < 0.5) melodyFreq = 554; // C#5
    else if ((t % 1) < 0.75) melodyFreq = 659; // E5
    else melodyFreq = 880; // A5
    
    const melody = Math.sin(2 * Math.PI * melodyFreq * t) * 0.3;
    
    loopSamples[i] = (base + melody) * 0.5;
}
writeWav('uploads/audio/insert_coin_loop.wav', loopSamples);
