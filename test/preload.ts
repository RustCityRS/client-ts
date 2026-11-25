// Bun 1.2 can otherwise resolve this worklet as executable JS when the first
// import of PcmOutput happens inside a synchronous gamepack class loader.
import workletSource from '../src/audio/pcm-worklet.js' with { type: 'text' };

// Bun can continue to later test files after a preload throws.
try {
    if (typeof workletSource !== 'string') throw new Error('Expected embedded PCM worklet source');
    await import('./reference.js');
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
