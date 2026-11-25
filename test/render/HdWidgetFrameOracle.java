import java.awt.Frame;
import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

// HD client.f(40) -> jm.a(true) / ha.a(0) -> al.a(true) -> ag.a -> gn.a.
// The real loaded th.j group contains nested ordinary widgets. Only the
// original JOGL interface/drawable and AWT display are supplied by the harness.
public final class HdWidgetFrameOracle {
    static be component(int id,int parent,int type,int x,int y,int width,int height,int rgb) {
        be c=new be();
        c.Fc=id;c.N=parent;c.I=type;c.Hb=true;c.jd=x;c.jb=y;c.n=width;c.R=height;c.rb=rgb;
        return c;
    }
    static void field(String name,Object value)throws Exception {
        Field field=tf.class.getDeclaredField(name);field.setAccessible(true);field.set(null,value);
    }
    static String roots() {
        StringJoiner rows=new StringJoiner(";");
        for(int i=0;i<bn.V;i++)rows.add(vh.b[i]+","+e.sc[i]+","+sd.V[i]+","+fe.lb[i]+","+
            (ch.y[i]?1:0)+","+(pa.R[i]?1:0)+","+(sc.z[i]?1:0));
        return rows.toString();
    }
    public static void main(String[] ignored)throws Exception {
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");Field f=unsafe.getDeclaredField("theUnsafe");
        f.setAccessible(true);Object vm=f.get(null);
        var allocate=unsafe.getMethod("allocateInstance",Class.class);
        client game=(client)allocate.invoke(vm,client.class);
        nk.O=new e();fh.Y=(Frame)allocate.invoke(vm,Frame.class);
        tf.t=HdFrameBoundaryOracle.driver("G");field("E",HdFrameBoundaryOracle.drawable());
        md.L=new HdFrameBoundaryOracle.Screen();
        Field clipRight=dj.class.getDeclaredField("d");clipRight.setAccessible(true);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;) {
            int[] a=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int state=a[0],width=a[1],height=a[2],mode=a[3];
            cl.bb=false;hi.f=0;fh.P=false;ca.ab=true;na.h=false;id.f=false;
            tl.d=state;md.W=1;tf.w=true;
            tf.J=dl.d=width;tf.A=uj.B=height;
            // JVM initial GL cache for the first primitive. Leave it warm on the next frame.
            field("o",false);field("s",-1);field("l",true);field("u",true);field("F",true);field("d",false);
            gj.d=417;qc.U=0;rh.o=-100;sc.v=-100;
            sc.m=new boolean[]{false,true};th.j=new be[2][];
            be parent=component(65536,-1,0,7,5,19,15,0);
            be fill=component(65537,65536,3,-3,3,13,10,0x916abc);
            fill.zb=true;fill.wb=mode==1?0:71;
            be inner=component(65538,65536,0,9,6,13,10,0);
            be nestedLine=component(65539,65538,9,-2,-3,15,12,0x7843f9);
            nestedLine.Zb=1;nestedLine.m=mode!=1;
            be border=component(65540,-1,3,29,2,11,14,0xedea15);
            border.wb=mode==1?133:0;
            be last=component(65541,-1,9,9,22,24,6,0x8832c1);last.Zb=1;
            th.j[1]=new be[]{parent,fill,inner,nestedLine,border,last};
            bn.V=a[4];pa.R=new boolean[100];ch.y=new boolean[3];sc.z=new boolean[100];
            HdFrameBoundaryOracle.testGlFault=false;HdFrameBoundaryOracle.fault=0;
            for(int repeat=0;repeat<2;repeat++) {
                int titlePasses=jm.C,gamePasses=ha.d;
                HdFrameBoundaryOracle.events.clear();game.f(40);
                System.out.println(String.join(";",HdFrameBoundaryOracle.events)+"|"+roots()+"|"+
                    dj.c+","+dj.b+","+clipRight.getInt(null)+","+dj.e+"|"+parent.Uc+","+fill.Uc+","+inner.Uc+","+nestedLine.Uc+","+border.Uc+","+last.Uc+
                    "|"+(jm.C-titlePasses)+","+(ha.d-gamePasses));
            }
        }
    }
}
