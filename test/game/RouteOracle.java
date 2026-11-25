import java.io.*;
import java.util.zip.DeflaterOutputStream;

final class RouteOracle {
    static void writeRows(DataOutputStream out,int[][] rows) throws IOException {
        for (int[] row : rows) for (int value : row) out.writeInt(value);
    }
    public static void main(String[] args) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        DataOutputStream out=new DataOutputStream(new BufferedOutputStream(new DeflaterOutputStream(System.out)));
        te.g=new pb();
        var actorSize=ob.class.getDeclaredField("A");
        actorSize.setAccessible(true);
        qk.v.a(new int[]{9,7,5,3},-7);
        int maps=in.readInt();
        for (int m=0;m<maps;m++) {
            ke map=hc.c[0]=new ke(in.readInt(),in.readInt());
            for (int[] row: map.d) for(int z=0;z<row.length;z++) row[z]=in.readInt();
            int cases=in.readInt();
            for (int j=0;j<cases;j++) {
                int size=in.readInt(),sx=in.readInt(),sz=in.readInt(),tx=in.readInt(),tz=in.readInt();
                int width=in.readInt(),height=in.readInt(),shape=in.readInt(),angle=in.readInt(),sides=in.readInt();
                boolean near=in.readInt()!=0;
                int mode=in.readInt(),npcSize=in.readInt();
                actorSize.setInt(te.g,size);
                if(npcSize<0) te.g.pc=null;
                else {
                    te.g.pc=new cl();
                    te.g.pc.k=501;
                    ja type=new ja(); type.M=npcSize;
                    gf.Z.a(501L,type,(byte)-71);
                }
                qk.v.yb=0;
                int result;
                try {
                    result=hj.a(width,tz,tx,height,(byte)-6,near,angle,sides,sz,shape+1,mode,sx)?1:0;
                } catch (g wrapped) {
                    if(!(wrapped.a instanceof IndexOutOfBoundsException)) throw wrapped;
                    result=-1;
                }
                out.writeInt(result);
                out.writeInt(ba.a);
                writeRows(out,pe.O);
                writeRows(out,qd.t);
                for(int value:n.j) out.writeInt(value);
                for(int value:u.b) out.writeInt(value);
            }
        }
        out.close();
    }
}
