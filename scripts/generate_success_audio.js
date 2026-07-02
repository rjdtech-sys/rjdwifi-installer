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

// 3. Generate "Connected Success" (Ascending Chime)
const successDuration = 1.5;
const successRate = 44100;
const successSamples = new Float32Array(successDuration * successRate);

for (let i = 0; i < successSamples.length; i++) {
    const t = i / successRate;
    
    // Major triad arpeggio (C5, E5, G5, C6)
    let freq = 0;
    let env = 0;
    
    if (t < 0.2) { freq = 523.25; env = 1 - (t/0.2); } // C5
    else if (t < 0.4) { freq = 659.25; env = 1 - ((t-0.2)/0.2); } // E5
    else if (t < 0.6) { freq = 783.99; env = 1 - ((t-0.4)/0.2); } // G5
    else { freq = 1046.50; env = Math.exp(-(t-0.6)*3); } // C6 (longer sustain)
    
    // Add some harmonics for "sparkle"
    const val = Math.sin(2 * Math.PI * freq * t) * 0.5 + 
                Math.sin(2 * Math.PI * freq * 2 * t) * 0.1;
                
    successSamples[i] = val * env * 0.5;
}
writeWav('uploads/audio/connected.wav', successSamples);
