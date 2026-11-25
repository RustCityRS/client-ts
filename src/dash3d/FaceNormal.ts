// ha in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::FaceNormal): the normal (scaled to length 256) of one
// flat-shaded face (face render type 1). Only ModelUnlit.CalculateNormals creates it (ModelUnlit.faceNormal, one per
// face, null for the other render types); ModelLitImpl lights those faces from it instead of from the vertex normals.
// Field names: j = x, l = y, h = z (the same axes as PointNormal).
//
// Not here, by the member map: ha.e/g/i/k are invocation counters. ha.a(Z)V is an unload artifact: it nulls ha.b
// (Client texturesArchive) and ha.f (ObjType defaultName), both homed in other classes, and then calls ha.a(II)I
// (ObjType.group) only when its dummy flag is true (client.java passes false, so the call never runs).
// Every other ha static (ha.a(B)I, ha.a(BI)V, ha.a(ZILal;I)[Lrh;, ha.a(II)I and the fields a, b, c, d, f) belongs to
// another class (see membermap.json).
export default class FaceNormal {
    // ha.h:I
    z = 0;
    // ha.j:I
    x = 0;
    // ha.l:I
    y = 0;

    // ha.<init>()V
    constructor() {}
}
