import type IfType from './IfType';

export default class ComponentDrag {
    static dragLayerX = 0; // gf.db:I
    static dragLayerComponents: (IfType | null)[] | null = null; // jg.q:[Laj;
    static dragLayerY = 0; // ma.n:I
    static dragMouseX = 0; // c.A:I
    static dragMouseY = 0; // c.s:I
    static component: IfType | null = null; // pe.T:Laj;
    static parent: IfType | null = null; // vf.Y:Laj;
    static target: IfType | null = null; // m.W:Laj;
    static visible = false; // wg.d:Z
    static parentVisible = false; // bk.vc:Z
    static x = -1; // sg.c:I
    static y = -1; // kh.D:I
    static parentX = -1; // oe.s:I
    static parentY = -1; // oa.g:I
    static cycles = 0; // h.a:I
    static started = false; // ed.h:Z
}
