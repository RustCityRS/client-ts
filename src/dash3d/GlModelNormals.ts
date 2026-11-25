// HD de. The model keeps these normal arrays while it merges coincident vertices with another model.
export default class GlModelNormals {
    normalCount: Int16Array | null = null; // de.a
    normalX: Int16Array | null = null; // de.b
    normalZ: Int16Array | null = null; // de.c
    normalY: Int16Array | null = null; // de.d
}
