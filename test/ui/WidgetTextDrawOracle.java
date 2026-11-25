import java.io.*;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;

// The original lf.a draws into td.g using archive-8 glyphs and archive-13 metrics.
public class WidgetTextDrawOracle {
    static int fontId;
    static final Field[] fontState = new Field[5];
    static final int W = 192, H = 78;

    static id text(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.ISO_8859_1);
        return ea.a(bytes,0,bytes.length,0);
    }

    static String run(String input) throws Exception {
        int[] p = Arrays.stream(input.split(" ")).mapToInt(Integer::parseInt).toArray();
        int flags=p[0], item=p[1], count=p[2], fault=p[3], layout=p[4], region=p[5];
        boolean active=(flags&2)!=0;
        aj c=new aj();
        c.Kc=42; c.n=-1; c.ob=4; c.y=(flags&1)!=0;
        c.ib=27; c.Mb=8; c.C=layout==4?8:layout==5?128:96; c.H=layout==4?6:50;
        c.mc=fault==1?-1:(fault==2||fault==6)?100000:fontId;
        c.S=220; c.bb=layout%4; c.Jb=(layout/2)%4; c.L=(layout%3)*5; c.nc=(flags&4)!=0;
        c.bd=new int[]{0}; c.eb=new int[]{active?75:7};
        c.Vb=new int[][]{{20,75,0},{20,-2147483648,0},{20,1000000001,0}};
        c.gb=text("M\u00ff<img=0> %1 / %2<br><col=ff0000>B</col> %3");
        c.l=(flags&8)!=0?text(""):text("Act<shad=405060>\u00f6</shad> %1");
        c.oc=0x567adc;c.I=0x76ec35;c.B=(flags&32)!=0?0:0xbee526;c.kd=(flags&32)!=0?0:0xef56dc;
        c.yc=item;c.xc=count;
        if(fault==3)c.l=null;
        if(fault==4)c.gb=null;
        if(fault==5)c.eb=null;
        if(fault==8)c.eb=new int[0];
        di.g=(flags&16)!=0?c:null;
        ca.g=(flags&64)!=0?c:null;
        ve.l=text("continue %1<gt>");
        if(fault==7)ve.l=null;
        vk.db=fault==6?599:600; hh.kb=600; ik.G=2;
        sf.m=new boolean[100]; n.i=new boolean[100]; n.i[2]=region<3; ml.T=region==4?2:0;
        rk.o=true; uc.c=false; ie.F=true;
        for (Field field:fontState)field.setInt(null,79);
        int[] pixels=new int[fault==9?W*28:W*H];
        for(int i=0;i<pixels.length;i++)pixels[i]=0x324567^(i*0x670a31);
        td.a(pixels,W,H);
        int left=region==1?30:region==2?78:1,top=region==1?19:region==2?49:1;
        int right=region==1?75:region==2?78:W-1,bottom=region==1?51:region==2?49:H-1;
        String result="ok";
        try {lf.a(0,new aj[]{c},-1,bottom,top,-1,right,0,true,left);}
        catch(RuntimeException ex) {
            Throwable cause=ex;
            while(cause instanceof g w)cause=w.a;
            if(cause instanceof NullPointerException)result="null";
            else if(cause instanceof IndexOutOfBoundsException)result="bounds";
            else throw ex;
        }
        ByteBuffer buf=ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
        buf.asIntBuffer().put(pixels);
        StringJoiner state=new StringJoiner(" ");
        state.add(result).add(""+rk.o).add(""+sf.m[2]);
        for(Field field:fontState)state.add(""+field.getInt(null));
        for(int v:new int[]{td.e,td.b,td.h,td.d})state.add(""+v);
        state.add(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buf.array())));
        return state.toString();
    }

    public static void main(String[] args) throws Exception {
        Path dir=Path.of(args[0]);
        String[] names={"tb","lb","rb","qb","ob"};
        for(int i=0;i<names.length;i++){
            fontState[i]=mb.class.getDeclaredField(names[i]);
            fontState[i].setAccessible(true);
        }
        try(var sprites=new ProceduralTextureCacheOracle.Disk(dir,8);
            var metrics=new ProceduralTextureCacheOracle.Disk(dir,13);
            var objects=new ProceduralTextureCacheOracle.Disk(dir,19)) {
            h.f=new al(sprites,true,true);
            pb.nc=new al(metrics,true,true);
            bj.a(new al(objects,true,true),-113,true,null,null);
            fontId=h.f.a((byte)95,text("b12_full"));
            ag.k=new si[]{new ch(7,3,0,0,7,3,new byte[]{
                1,1,1,1,1,1,1,1,0,0,1,0,0,1,1,1,1,1,1,1,1},new int[]{0,0xc0ff31})};
            kl unnamed=rg.a(1002,-28322);unnamed.s=null;
            var reader=new BufferedReader(new InputStreamReader(System.in));
            for(String row;(row=reader.readLine())!=null;)System.out.println(run(row));
        }
    }
}
