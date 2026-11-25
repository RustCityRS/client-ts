import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Unmodified main redraw, interface walk, minimenu, cursor, game tick and
// outbound packet writer. The loaded widget and cursor caches replace JS5 I/O.
public final class WidgetMenuFramesOracle {
    static final int WIDTH=96,HEIGHT=48;
    static aj widget(int slot,int op,int cursor,String name) {
        aj c=new aj();c.n=-1;c.Kc=0x10000+slot;c.ob=3;c.y=true;c.ib=5+45*slot;c.Mb=4;c.C=34;c.H=21;
        c.Sc=new l(1<<op,-1);c.Yc=new id[op];c.Yc[op-1]=vb.a(name,(byte)55);
        c.v=new int[op];c.v[op-1]=cursor;c.r=vb.a(slot==0?"Left target":"Right target",(byte)55);
        return c;
    }
    static client init(int width,int height)throws Exception {
        GameProtocolOracle.init();ek.s=null;
        client app=WindowModeOracle.container(client.class);
        aj.kb=WindowModeOracle.container(WindowModeOracle.TestFrame.class);
        Class<?> type=Class.forName("sun.misc.Unsafe");Field field=type.getDeclaredField("theUnsafe");
        field.setAccessible(true);tj.m=(fb)type.getMethod("allocateInstance",Class.class).invoke(field.get(null),fb.class);
        tj.m.o=dg.B=app;
        BufferedImage screen=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);
        pe.S=new Canvas(){public Graphics getGraphics(){return screen.getGraphics();}};
        wc pixels=new wc();pixels.a(height,width,pe.S,(byte)-34);rg.s=pixels;
        hi.f=vk.rb=width;fl.l=oh.j=height;pa.rb=sk.N=0;
        we.y=qf.f=wd.b=hi.g=false;oa.a=0;
        hd.m=1;fk.ab=new aj[2][];fk.ab[1]=new aj[]{widget(0,1,41,"Left"),widget(1,2,73,"Right")};
        rg.b=new boolean[]{false,true};
        for(int cursor:new int[]{41,73}){
            r.X.a(cursor,new dl(),(byte)-71);
        }
        ii.i.a(0,new rh(1,1),(byte)-71);
        wj.g=new fg(new byte[257],new int[256],new int[256],new int[256],new int[256],new byte[256][0]);
        wb.db=true;ig.t=qh.c=aa.e=-1;vb.o=pk.k=ik.G=0;g.n=ef.J=0;ve.g=8;ud.j=9;
        ie.F=uc.c=false;te.g.Z=te.g.S=4096;
        Arrays.fill(sf.m,true);Arrays.fill(n.i,false);
        return app;
    }
    public static void main(String[] args)throws Exception {
        client app=init(WIDTH,HEIGHT);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String row;(row=input.readLine())!=null;){
            int[] a=Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            int step=a[0];tf.C=a[1];sj.C=a[2];pf.Q=a[3];sa.x=a[4];oj.e=a[5];oi.h=a[6];ca.a=0;
            ea.c=100;lc.v=150;tj.h=false;tj.i=false;wg.g=rj.x=true;
            qk.v.yb=0;qk.v.a(new int[]{1,2,3,4},0);
            if(step==0)app.d(0);else t.c(100);
            StringJoiner options=new StringJoiner(";");
            for(int i=0;i<vb.o;i++)options.add(p.u[i]+","+ia.n[i]+","+mh.h[i]+","+ml.x[i]+","+sa.z[i]);
            System.out.println(String.join("|",""+vb.o,options.toString(),ve.g+","+ud.j,pk.k+","+g.n+","+ef.J,
                ""+qh.c,HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb)));
        }
    }
}
