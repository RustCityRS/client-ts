// The browser bundle defines the GL gamepack identity. Source-only JAR tests
// select the reference they run against; the original SD suite uses client.jar.
export const glJar = process.env.RS530_GAMEPACK_IDENTITY === 'gl';
