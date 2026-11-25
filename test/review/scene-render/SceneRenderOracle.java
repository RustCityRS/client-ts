import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.IdentityHashMap;

// Differential oracle for the RENDER half of the revision 530 scene graph: the TS class `world`
// (src/dash3d/world.ts: draw (qc.a), CalcOcclude (ke.a), Render (ad.a), Fill (p.a), renderQuickGround (ug.a),
// drawTileOverlay (sb.a), updateMousePicking (sc.a), testColumn (q.a), InsideTriangle (le.a), TextureLightCol (nf.a)
// and the occlusion tests Occluded/GroundoOcluded/WallOccluded/SpriteOccluded/SpriteOccluded2 (tj.a/bh.a/wk.a/cf.a/pe.a))
// together with the entities it reads (ra/ec/jg/hk/nf/pk/mh/kb/ma). Compiled into the jar's unnamed package
// (javac -cp client.jar), so it calls the package-private statics directly, subclasses ug and implements pc. None of
// these routines has an od.a wrapper; a g is unwrapped to its cause anyway.
//
// Reads one operation per line on stdin and prints exactly one line per operation:
//   <result>|<calls>|<state>
// <result> is the return value, "ok", or the Java exception (aioobe/npe/nase/arith/cce).
// <calls> is the ordered log of every call the scene graph made into the test models (TM: every draw with all its
// arguments plus the hash of the framebuffer at the moment of the call, so the interleaving of ground rasterization
// and model draws is compared; update/getMinY/isUnlit/light/mergeNormals with their arguments) and into the texture
// provider (TP).
// <state> follows a draw, a ground sweep or "state": the framebuffer hash, the scene statics (eye, bounds, camera
// angles, pick result, cycle, fillLeft, levels), every active occluder with its mode and slopes, the visibility and
// corner-visibility maps in full, the hash of every square's render fields (drawFront/drawBack/drawSprites/
// cornerSides/sidesBeforeCorner/sidesAfterCorner/backWallTypes), the hash of every sprite's cycle/distance, the tile
// occlusion cycles, kb's draw scratch arrays, dc.e/dc.j, the hidden-roof arrays and whether the draw queue is empty.
// scene-render.test.ts runs the same script through the TS port and compares the lines.
//
// Usage: javac -cp client.jar -d <dir> SceneRenderOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> SceneRenderOracle < script
class SceneRenderOracle {
    static final StringBuilder log = new StringBuilder();

    static void call(String token) {
        log.append(' ').append(token);
    }

    static int fbHash() {
        int[] p = td.g;
        if (p == null) return -1;
        int h = 0;
        for (int v : p) h = 31 * h + v;
        return h;
    }

    // getMinY of a test model: -32768 (none) when id % 7 == 0, below the ground when id % 11 == 0, else above it.
    static int minY(int id) {
        if (id % 7 == 0) return -32768;
        if (id % 11 == 0) return 50 + id % 13;
        return -((id * 37) % 400);
    }

    static final class TM extends ug {
        final int id;

        TM(int id) {
            this.id = id;
        }

        void a(int yaw, int sinPitch, int cosPitch, int sinYaw, int cosYaw, int x, int y, int z, long typecode, int level, ue particles) {
            call("D" + id + "," + yaw + "," + sinPitch + "," + cosPitch + "," + sinYaw + "," + cosYaw + "," + x + "," + y + "," + z + "," + typecode + "," + level + "," + (particles == null ? 0 : 1) + "@" + fbHash() + "," + dc.e);
            // A real model leaves the transparency of its last face in dc.e; the ground renderers must reset it.
            dc.e = id * 37 & 0xff;
        }

        int b() {
            call("B" + id);
            return minY(id);
        }

        void a(int arg0, int arg1, int arg2, int arg3, int arg4) {
            call("U" + id + "," + arg0 + "," + arg1 + "," + arg2 + "," + arg3 + "," + arg4);
        }

        boolean a() {
            call("A" + id);
            return id < 1000 && id % 3 == 0;
        }

        ug a(int lx, int ly, int lz) {
            call("L" + id + "," + lx + "," + ly + "," + lz);
            return new TM(id + 1000);
        }

        void a(ug other, int ox, int oy, int oz, boolean hide) {
            call("M" + id + "," + ((TM) other).id + "," + ox + "," + oy + "," + oz + "," + (hide ? 1 : 0));
        }
    }

    // Texels: 64x64 for even ids, 128x128 for odd ids, none (null) when id % 5 == 4; every 13th texel is 0 (transparent
    // unless the texture is solid, which it is unless id % 3 == 0).
    static int texel(int id, int i) {
        if ((i * 7 + id) % 13 == 0) return 0;
        int v = (i + 1) * 0x9e3779b1 ^ id * 0x85ebca6b;
        v ^= v >>> 13;
        v *= 0x5bd1e995;
        v ^= v >>> 15;
        return v & 0xffffff;
    }

    static final int[][] TEXELS = new int[16][];

    static int[] pixels(int id) {
        if (id < 0 || id >= TEXELS.length || id % 5 == 4) return null;
        if (TEXELS[id] == null) {
            int[] t = new int[id % 2 == 0 ? 4096 : 16384];
            for (int i = 0; i < t.length; i++) t[i] = texel(id, i);
            TEXELS[id] = t;
        }
        return TEXELS[id];
    }

    static final class TP implements pc {
        public boolean a(int id, int dummy) {
            call("Ls" + id + (dummy == 0 ? "" : "!" + dummy));
            return id % 2 == 0;
        }

        public boolean b(int dummy, int id) {
            call("Av" + id + (dummy == 0 ? "" : "!" + dummy));
            return true;
        }

        public int[] c(int dummy, int id) {
            call("Gp" + id + (dummy == 117 ? "" : "!" + dummy));
            return pixels(id);
        }

        public boolean a(int id, byte dummy) {
            call("Ld" + id + (dummy == -95 ? "" : "!" + dummy));
            return true;
        }

        public int[] a(int id, float brightness, int dummy) {
            call("P" + id + "," + Float.floatToIntBits(brightness) + (dummy == 15964 ? "" : "!" + dummy));
            return pixels(id);
        }

        public int a(byte dummy, int id) {
            call("V" + id + (dummy <= -118 && dummy >= -125 ? "" : "!" + dummy));
            return (id * 911 + 300) & 0xffff;
        }

        public boolean d(int dummy, int id) {
            call("O" + id + (dummy == 0 ? "" : "!" + dummy));
            return id % 3 != 0;
        }
    }

    static ug model(int id) {
        return id < 0 ? null : new TM(id);
    }

    // ---- state ----

    static int hash(int[] values) {
        if (values == null) return -1;
        int h = 0;
        for (int v : values) h = 31 * h + v;
        return h;
    }

    static int hash3(int[][][] values) {
        if (values == null) return -1;
        int h = 0;
        for (int[][] plane : values)
            for (int[] row : plane) h = 31 * h + hash(row);
        return h;
    }

    static String bits(boolean[][] values) {
        if (values == null) return "n";
        StringBuilder sb = new StringBuilder();
        int acc = 0, n = 0;
        for (boolean[] row : values) {
            for (boolean v : row) {
                acc = acc << 1 | (v ? 1 : 0);
                if (++n == 4) {
                    sb.append(Character.forDigit(acc, 16));
                    acc = 0;
                    n = 0;
                }
            }
        }
        if (n > 0) sb.append(Character.forDigit(acc, 16)).append('/').append(n);
        return values.length + "x" + (values.length == 0 ? 0 : values[0].length) + ":" + sb;
    }

    static String occluder(jg c) {
        if (c == null) return "null";
        return c.d + "," + c.r + "," + c.m + "," + c.h + "," + c.A + "," + c.n + "," + c.c + "," + c.g + "," + c.i + "," + c.o + "," + c.a + "," + c.u + "," + c.e + "," + c.s + "," + c.f + "," + c.b + "," + c.j + "," + c.y;
    }

    static String layer(ra[][][] squares) {
        if (squares == null) return "n";
        IdentityHashMap<ec, Boolean> seen = new IdentityHashMap<>();
        StringBuilder flags = new StringBuilder();
        StringBuilder sprites = new StringBuilder();
        for (ra[][] plane : squares) {
            for (ra[] row : plane) {
                for (ra r : row) {
                    if (r == null) {
                        flags.append('n');
                        continue;
                    }
                    flags.append(r.K).append(r.B ? 'F' : 'f').append(r.J ? 'B' : 'b').append(r.E ? 'S' : 's');
                    flags.append(r.D).append(',').append(r.I).append(',').append(r.U).append(',').append(r.G).append(';');
                    for (int i = 0; i < 5; i++) {
                        ec s = r.H[i];
                        if (s != null && seen.put(s, Boolean.TRUE) == null) sprites.append(s.r).append(',').append(s.l).append(';');
                    }
                }
            }
        }
        return flags.toString().hashCode() + "/" + sprites.toString().hashCode();
    }

    static String state() {
        StringBuilder sb = new StringBuilder();
        sb.append("fb=").append(fbHash());
        sb.append(" c").append(la.kb).append(',').append(af.O).append(',').append(ah.i);
        sb.append(" e").append(lk.q).append(',').append(ea.l).append(',').append(rg.t).append(',').append(hh.Z).append(',').append(gf.W);
        sb.append(" b").append(ia.r).append(',').append(lh.f).append(',').append(pg.E).append(',').append(jl.k);
        sb.append(" a").append(tb.j).append(',').append(qf.a).append(',').append(wa.g).append(',').append(ph.n);
        sb.append(" p").append(o.O ? 1 : 0).append(',').append(ak.j).append(',').append(oh.k).append(',').append(rc.b).append(',').append(si.t).append(',').append(hl.Y);
        sb.append(" l").append(ki.W).append(',').append(l.r).append(',').append(kl.Bb == null ? "n" : kl.Bb == na.G ? "m" : kl.Bb == vf.V ? "u" : "?");
        sb.append(',').append(ve.q == null ? "n" : ve.q == lf.g ? "m" : ve.q == nh.S ? "u" : "?");
        sb.append(" r").append(bf.u).append(',').append(tg.x).append(',').append(qi.Y);
        sb.append(" o").append(mc.P).append(',').append(rj.s);
        for (int i = 0; i < rj.s; i++) {
            jg c = uf.v[i];
            int index = -1;
            for (int j = 0; j < mc.P; j++) if (ll.c[j] == c) index = j;
            sb.append(" [").append(index).append(':').append(occluder(c)).append(']');
        }
        sb.append(" v").append(bits(tj.j)).append(" cv").append(bits(client.hb));
        sb.append(" sq").append(layer(na.G)).append(" uw").append(layer(vf.V));
        sb.append(" dyn");
        if (pa.xb != null) for (int i = 0; i < ah.i && i < pa.xb.length; i++) sb.append(pa.xb[i] == null ? "-" : pa.xb[i].r + "/" + pa.xb[i].l).append(';');
        sb.append(" t").append(hash3(il.P));
        sb.append(" g").append(hash(kb.v)).append(',').append(hash(kb.f)).append(',').append(hash(kb.u)).append(',').append(hash(kb.q)).append(',').append(hash(kb.r));
        sb.append(" x").append(dc.e).append(',').append(dc.j ? 1 : 0);
        sb.append(" h").append(hash(de.w)).append(',').append(hash(hf.D)).append(',').append(hash(ek.i)).append(',').append(hash(aj.Ub)).append(',').append(hash(rj.p));
        sb.append(" q").append(v.F.c.g == v.F.c ? "empty" : "busy");
        return sb.toString();
    }

    // ---- inputs shared with the TS side ----

    static void fill(int[] px, int seed) {
        for (int i = 0; i < px.length; i++) {
            int v = i * 0x2545f491 ^ seed * 0x27d4eb2f;
            v ^= v >>> 15;
            px[i] = seed == 0 ? 0 : v;
        }
    }

    static byte[][][] roofs;
    static byte[][][] smallRoofs;

    // The five hidden-roof arrays world.draw takes (y, min x, max x, max z, min z), by variant.
    static int[][] hideAreas(int variant) {
        switch (variant) {
            case 0:
                return new int[5][];
            case 1:
                return new int[][] {{-1000000, -200, -1000000}, {0, 256, 0}, {0, 900, 0}, {0, 1200, 0}, {0, 128, 0}};
            case 2:
                return new int[][] {{-100, 50}, {640, -5000}, {1600, 5000}, {1800, 5000}, {256, -5000}};
            case 3:
                // A hide area that takes in the whole map at every height.
                return new int[][] {{100000}, {-100000}, {100000}, {100000}, {-100000}};
            case 4:
                // Mismatched lengths: the third area has no max x/max z/min z entries.
                return new int[][] {{-1000000, -1000000, -50}, {0, 0}, {5000, 5000}, {5000, 5000}, {0, 0}};
            case 5:
                // Every bound exactly on the occluder "occ 1 1024 1024 512 1536 -400 -40" (minY, minX, minX, minZ, minZ).
                return new int[][] {{-400}, {1024}, {1024}, {512}, {512}};
            case 6:
                // One past it in y.
                return new int[][] {{-401}, {1024}, {1024}, {512}, {512}};
            case 7:
                // One past it in x (the area's max x below the occluder's x).
                return new int[][] {{-400}, {1024}, {1023}, {512}, {512}};
            default:
                // One past it in z (the area's min z above the occluder's z range).
                return new int[][] {{-400}, {1024}, {1024}, {512}, {1537}};
        }
    }

    public static void main(String[] argv) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        StringBuilder out = new StringBuilder();
        int lineNo = -1;
        for (String line; (line = in.readLine()) != null;) {
            if (line.isEmpty()) continue;
            lineNo++;
            String[] f = line.split(" ");
            String op = f[0];
            long[] a = new long[f.length - 1];
            for (int i = 1; i < f.length; i++) a[i - 1] = Long.parseLong(f[i]);
            int[] n = new int[a.length];
            for (int i = 0; i < a.length; i++) n[i] = (int) a[i];
            log.setLength(0);
            String result;
            String post = "";
            try {
                result = run(op, n, a);
            } catch (Throwable t) {
                while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
                // -Dsr.trace=1 prints where each exception came from (diagnostics only; stderr is not compared).
                if (Boolean.getBoolean("sr.trace")) {
                    System.err.println("#" + lineNo + " " + line);
                    t.printStackTrace();
                }
                if (t instanceof ArrayIndexOutOfBoundsException) result = "aioobe";
                else if (t instanceof NullPointerException) result = "npe";
                else if (t instanceof NegativeArraySizeException) result = "nase";
                else if (t instanceof ArithmeticException) result = "arith";
                else if (t instanceof ClassCastException) result = "cce";
                else throw new RuntimeException(t);
            }
            if (op.equals("draw") || op.equals("gsweep") || op.equals("state")) post = state();
            out.append(result).append('|').append(log).append('|').append(post).append('\n');
            if (out.length() > 1 << 20) {
                System.out.print(out);
                out.setLength(0);
            }
        }
        System.out.print(out);
        System.out.flush();
    }

    static String run(String op, int[] n, long[] a) {
        switch (op) {
            case "fb": {
                // fb <width> <height> <clip x0> <clip y0> <clip x1> <clip y1>
                td.g = new int[n[0] * n[1]];
                td.c = n[0];
                td.i = n[1];
                td.e = n[2];
                td.b = n[3];
                td.h = n[4];
                td.d = n[5];
                dc.d();
                return "ok";
            }
            case "origin":
                dc.c(n[0], n[1]);
                return dc.f + "," + dc.b;
            case "pal": {
                int[] colours = new int[65536];
                for (int i = 0; i < colours.length; i++) colours[i] = (i * 0x9e3779b1 ^ (i << 7) ^ n[0]) & 0xffffff;
                dc.o = colours;
                return "ok";
            }
            case "tp":
                dc.a(n[0] != 0 ? new TP() : null);
                return "ok";
            case "tex":
                lf.j = n[0] != 0;
                return "ok";
            case "ld":
                dc.a = n[0] != 0;
                return "ok";
            case "init":
                mc.a(n[0], n[1], n[2], n[3], n[4] != 0);
                return "ok";
            case "hm": {
                // hm <mode> <seed>: 0 gentle, 1 rough and steep, 2 flat, 3 cliffs; level L is 240 * L higher.
                int mode = n[0], seed = n[1];
                for (int level = 0; level < lf.g.length; level++)
                    for (int x = 0; x < lf.g[level].length; x++)
                        for (int z = 0; z < lf.g[level][x].length; z++) lf.g[level][x][z] = height(mode, seed, x, z) - level * 240;
                if (nh.S != null)
                    for (int x = 0; x < nh.S[0].length; x++)
                        for (int z = 0; z < nh.S[0][x].length; z++) nh.S[0][x][z] = height(mode, seed + 7, x, z) + 200;
                return "ok";
            }
            case "seth":
                // seth <level> <x> <z> <height>: one heightmap corner of the current layer.
                ve.q[n[0]][n[1]][n[2]] = n[3];
                return "ok";
            case "roofs": {
                roofs = new byte[n[0]][n[1]][n[2]];
                for (int level = 0; level < n[0]; level++)
                    for (int x = 0; x < n[1]; x++)
                        for (int z = 0; z < n[2]; z++) roofs[level][x][z] = (byte) (((x * 7 + z * 3 + level * 5 + n[3]) % 6) - 1);
                smallRoofs = new byte[n[0]][n[1] / 2][n[2]];
                return "ok";
            }
            case "reset":
                ng.e();
                return "ok";
            case "under":
                wd.a(n[0] != 0);
                return "ok";
            case "fbl":
                cf.a(n[0]);
                return "ok";
            case "push":
                fa.a(n[0], n[1]);
                return "ok";
            case "occ":
                og.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6]);
                return "ok";
            case "ground":
                uk.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12], n[13], n[14], n[15], n[16], n[17], n[18], n[19]);
                return "ok";
            case "gd":
                vf.a(n[0], n[1], n[2], n[3], model(n[4]), a[5], n[6] != 0);
                return "ok";
            case "obj":
                d.a(n[0], n[1], n[2], n[3], model(n[4]), a[5], model(n[6]), model(n[7]));
                return "ok";
            case "wall":
                ae.a(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], a[8]);
                return "ok";
            case "decor":
                ed.a(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], n[8], n[9], a[10]);
                return "ok";
            case "scen":
                return Boolean.toString(oe.a(n[0], n[1], n[2], n[3], n[4], n[5], model(n[6]), n[7], a[8]));
            case "dyn":
                return Boolean.toString(ob.a(n[0], n[1], n[2], n[3], n[4], model(n[5]), n[6], a[7], n[8] != 0));
            case "dyn2":
                return Boolean.toString(pa.a(n[0], n[1], n[2], n[3], model(n[4]), n[5], a[6], n[7], n[8], n[9], n[10]));
            case "rmspr":
                q.a();
                return "ok";
            case "sharelight":
                mk.a(n[0], n[1], n[2]);
                return "ok";
            case "pick":
                sc.a(n[0], n[1], n[2]);
                return "ok";
            case "draw": {
                // draw <eye x> <eye y> <eye z> <pitch> <yaw> <roofs 0/1/2> <roof min level> <roof byte> <anim x>
                //      <anim z> <hide variant> <fill seed>
                fill(td.g, n[11]);
                int[][] hide = hideAreas(n[10]);
                byte[][][] r = n[5] == 0 ? null : n[5] == 1 ? roofs : smallRoofs;
                qc.a(n[0], n[1], n[2], n[3], n[4], r, hide[0], hide[1], hide[2], hide[3], hide[4], n[6], (byte) n[7], n[8], n[9]);
                return "ok";
            }
            case "gsweep": {
                // gsweep <level> <occluded> <pick 0/1> <click x> <click y> <fill seed>: every ground of the level drawn
                // directly with the camera of the last draw, logging the framebuffer and pick result after each tile.
                fill(td.g, n[5]);
                if (n[2] != 0) {
                    o.O = true;
                    oh.k = n[3];
                    rc.b = n[4];
                    si.t = -1;
                    hl.Y = -1;
                }
                ra[][] plane = kl.Bb[n[0]];
                for (int x = 0; x < plane.length; x++) {
                    for (int z = 0; z < plane[x].length; z++) {
                        ra r = plane[x][z];
                        if (r == null) continue;
                        if (r.F != null) ug.a(r.F, n[0], tb.j, qf.a, wa.g, ph.n, x, z, n[1] != 0);
                        else if (r.x != null) sb.a(r.x, tb.j, qf.a, wa.g, ph.n, x, z, n[1] != 0);
                        else continue;
                        call("t" + x + "," + z + "=" + fbHash() + "," + si.t + "," + hl.Y + "," + dc.j);
                    }
                }
                o.O = false;
                return "ok";
            }
            case "state":
                return "ok";
            case "calc":
                ke.a();
                return "ok";
            case "col":
                return Boolean.toString(q.a(n[0], n[1], n[2], n[3], n[4]));
            case "occluded":
                return Boolean.toString(tj.a(n[0], n[1], n[2]));
            case "gocc":
                return Boolean.toString(bh.a(n[0], n[1], n[2]));
            case "wocc":
                return Boolean.toString(wk.a(n[0], n[1], n[2], n[3]));
            case "socc":
                return Boolean.toString(cf.a(n[0], n[1], n[2], n[3]));
            case "lvis":
                return Boolean.toString(pe.a(n[0], n[1], n[2], n[3], n[4], n[5]));
            case "tri":
                return Boolean.toString(le.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]));
            case "tlc":
                return Integer.toString(nf.a(n[0], n[1]));
            default:
                throw new IllegalStateException("unknown op " + op);
        }
    }

    static int height(int mode, int seed, int x, int z) {
        switch (mode) {
            case 0:
                return -(((x * 13 + z * 7 + seed) % 5) * 24) - 40;
            case 1:
                return -(((x * 31 + z * 17 + seed * 3) % 11) * 70) + 60;
            case 2:
                return -96;
            default:
                return ((x + seed) / 3 + z / 4) % 2 == 0 ? -40 : -520;
        }
    }
}
