// h: a static bucket with no instance members and no constructor (javap shows no <init>). Every static of h that
// is not an artifact belongs to another logical class in membermap.json: h.a(IIIIIII)V is
// TextureShapeRaster.drawRectOutlineThickClipped, h.a(ILal;)V is EnumType.init, h.e is TextureOp.sinTable, h.i is
// Client.m_pSprites, h.f is Component.spriteArchive, h.a is ComponentDrag.dragCycles and h.d is
// CookieStatics.cookiePathDomain. h.b, h.c, h.g and h.h are invocation counters (stripped).
export default class RectOutlineStatics {
    // h.a(B)V artifact: unload, nulls f, i, e and d when the applet shuts down (membermap kind artifact).
}
