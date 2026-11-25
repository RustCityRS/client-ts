// Small native modules travel with the client that calls their ABI. Decode each
// module once during browser startup, before the gamepack's synchronous methods.
export async function compileClientWasm(encoded: string | undefined): Promise<WebAssembly.Module | null> {
    if (!encoded) return null;
    try {
        const source = atob(encoded);
        const bytes = new Uint8Array(source.length);
        for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i);
        return await WebAssembly.compile(bytes);
    } catch {
        return null;
    }
}
