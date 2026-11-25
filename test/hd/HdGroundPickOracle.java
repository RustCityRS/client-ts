import java.util.HexFormat;
import java.util.Arrays;

/** The original HD plain/shaped floor pickers, with GL active. No drawable is needed for picking. */
public final class HdGroundPickOracle {
    static void minimap(int shape, int angle) {
        for (int base : new int[]{0, 0xfc439913}) {
            bj tile = new bj(0,0,0);
            if (shape == -1) tile.S = new rh(0,0,0,0,-1,base,false);
            else if (shape >= 0) tile.B = new fg(shape,angle,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,base,0x81fc33d2);
            kc.o[0][0][0] = shape == -3 ? null : tile;
            for (int[] layout : new int[][]{{28,1,7},{18,12,-4},{12,1,4},{0,0,1},{-1,0,0}}) {
                int[] pixels = layout[0] < 0 ? null : new int[layout[0]];
                if (pixels != null) Arrays.fill(pixels,112489);
                String result = "ok";
                try { ma.a(pixels,layout[1],layout[2],0,0,0); }
                catch (ArrayIndexOutOfBoundsException e) { result = "bounds"; }
                catch (NullPointerException e) { result = "null"; }
                System.out.println(result + " " + Arrays.toString(pixels));
            }
        }
    }

    static void dynamics(boolean underwater) {
        ma.i = hk.Y = 4;
        kc.o = new bj[2][4][4];
        gj.m = new int[2][5][5];
        gf.O = underwater ? gj.m : null;
        f.ab = new int[4][4];
        f.ab[2][1] = 275;
        tk.D = new ec[9];
        bl.T = 0;
        th model = new e();
        int[][] tiles = {{-1,0,-1,2,0},{0,1,1,2,2},{1,0,0,2,3},{1,1,1,1,1},{1,1,1,1,1},{1,1,1,1,1},
            {1,1,1,1,1},{1,1,1,1,1},{0,2,2,4,3},{0,3,3,2,2},{0,2,3,2,3},{0,2,3,2,3},{0,2,3,2,3}};
        for(int i=0;i<tiles.length;i++) {
            int[] a=tiles[i]; String result;
            try { result=""+ol.a(a[0],64+77*i,133-53*i,i-7,i==0?null:model,27*i,0x1234567890abcdefL-i,a[1],a[2],a[3],a[4]); }
            catch(ArrayIndexOutOfBoundsException e) { result="bounds"; }
            StringBuilder out=new StringBuilder(result).append(' ').append(bl.T);
            for(ec s:tk.D) if(s!=null) out.append(" /").append(s.A).append(',').append(s.s).append(',').append(s.f)
                    .append(',').append(s.j).append(',').append(s.o).append(',').append(s.x).append(',').append(s.h)
                    .append(',').append(s.a).append(',').append(s.w).append(',').append(s.e).append(',').append(s.c==model);
            for(int p=0;p<2;p++) for(int x=0;x<4;x++) for(int z=0;z<4;z++) {
                bj tile=kc.o[p][x][z];
                if(tile==null) continue;
                out.append(" /").append(p).append(',').append(x).append(',').append(z).append(',').append(tile.D).append(',').append(tile.y);
                for(int slot=0;slot<tile.y;slot++) out.append(',').append(Arrays.asList(tk.D).indexOf(tile.w[slot])).append(':').append(tile.P[slot]);
            }
            for(int[] line:f.ab) out.append(" /").append(Arrays.toString(line));
            System.out.println(out);
        }
    }

    static String change(cd c) {
        return Arrays.toString(new int[]{c.t,c.H,c.r,c.G,c.x,c.w,c.A,c.I,c.F,c.z,c.E,c.C});
    }

    static void changes() {
        System.out.println(change(new cd()));
        ca.X = new ih();
        for(int i=0;i<12;i++) {
            int p=i%2, x=1, z=1, layer=i%4;
            ce.a(p,z,-91,i%3,x,14-i,370+i,layer,9+i,2*i);
            StringBuilder out=new StringBuilder();
            for(cd change=(cd)ca.X.f(-96);change!=null;change=(cd)ca.X.e(4)) out.append(change(change));
            System.out.println(out);
        }
    }

    public static void main(String[] args) {
        final int x = 30, z = 31;
        tf.w = true;
        hf.m = 516;
        hf.b = 349;
        lj.B = x * 128 + 64;
        ml.K = -350;
        rj.R = z * 128 - 430;
        for (int underwater = 0; underwater <= 1; underwater++) {
            gj.m = new int[1][x+2][z+2];
            gf.O = underwater == 1 ? gj.m : null;
            int sw = underwater * 56, se = sw - 9, ne = sw + 25, nw = sw - 31;
            gj.m[0][x][z] = sw;
            gj.m[0][x+1][z] = se;
            gj.m[0][x+1][z+1] = ne;
            gj.m[0][x][z+1] = nw;
            for (int shape = -1; shape < 13; shape++) for (int angle = 0; angle < (shape < 0 ? 1 : 4); angle++) {
                rh plain = new rh(40,41,42,43,-1,0,false);
                fg shaped = shape < 0 ? null : new fg(shape,angle,3,x,z,sw,se,ne,nw,40,41,42,43,50,51,52,53,44,54);
                for (boolean occluded : new boolean[]{false,true}) {
                    byte[] bitmap = new byte[320];
                    for (int i = 0; i < 64 * 40; i++) {
                        int clickX = (i % 64 - 32) * 4;
                        int clickY = (i / 64 - 20) * 5 - 70;
                        il.a(0,clickX,clickY);
                        if (shaped == null) ke.a(plain,0,hf.g[256],hf.r[256],0,65536,x,z,occluded);
                        else lh.a(shaped,hf.g[256],hf.r[256],0,65536,x,z,occluded);
                        if (ef.g == x && jb.p == z) bitmap[i >> 3] |= 1 << (i & 7);
                        else if (ef.g != -1 || jb.p != -1) throw new AssertionError("wrong tile");
                    }
                    System.out.println(HexFormat.of().formatHex(bitmap));
                }
            }
        }
        kc.o = new bj[1][1][1];
        for (int shape=-3;shape<13;shape++) for (int angle=0;angle<(shape<0?1:4);angle++) minimap(shape,angle);
        int[] colours = {-2147483648,-1,0,1,127,128,0x8ff1,65535,2147483647};
        int[] factors = {-2147483648,-1,0,1,2,63,126,127,128,129,255,123456789,2147483647};
        for(int colour:colours) for(int factor:factors) System.out.println(ri.a(colour,factor));
        dynamics(false);
        dynamics(true);
        changes();
    }
}
