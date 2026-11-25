import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.Arrays;

// lf.a calls real mb/vc virtual glyph and sprite methods and loads a real type-6 model.
// A cooperating implementation changes the current widget type before returning.
final class WidgetTypeExitOracle {
    static final int W=48,H=32,LINE=0xb465c3;
    static aj component;
    static int next,callbacks;
    static void change() {callbacks++;component.ob=next;}
    static byte[] metrics() {byte[] a=new byte[257];Arrays.fill(a,(byte)2);return a;}
    static int[] sizes() {int[] a=new int[256];Arrays.fill(a,1);return a;}
    static class Font extends mb {
        Font(){super(metrics(),new int[256],new int[256],sizes(),sizes());}
        void a(int c,int x,int y,int w,int h,int colour,boolean shadow){change();td.d(x,y,1,1,colour);}
        void a(int c,int x,int y,int w,int h,int colour,int alpha,boolean shadow){throw new AssertionError();}
    }
    static void run(int original,int replacement,ProceduralTextureCacheOracle.Disk models,OutputStream frames)throws Exception {
        aj c=component=new aj();next=replacement;callbacks=0;
        c.n=-1;c.ob=original;c.Kc=12;c.ib=5;c.Mb=4;c.C=8;c.H=8;c.oc=LINE;c.Uc=1;
        c.y=original==5||original==6;c.mb=300;c.mc=311;c.gb=aj.a("T",(byte)-100);
        c.jc=-1;c.md=1;c.w=1100;c.vd=384;c.nd=32;c.e=true;
        c.G=c.M=1;c.Zb=new int[]{original==2?0:34};c.Ob=new int[]{1};
        c.yb=c.Gb=new int[20];c.lb=new int[]{300};
        c.yc=-1;gh.C=c;jf.i=gh.A=4;
        Font font=new Font();wj.g=font;cf.f=new ve(5);cf.f.a(311,font,(byte)-71);
        kl obj=new kl();obj.s=aj.a("O",(byte)-100);fa.b=new ve(5);fa.b.a(33,obj,(byte)-71);
        rh sprite=new rh(8,8){void c(int x,int y){change();super.c(x,y);}};
        Arrays.fill(sprite.I,0x136f21);bj.b=new ve(5);bj.b.a(300,sprite,(byte)-71);
        kk.R=new al(models,true,true);gf.S=new ve(5);te.g=new pb();
        n.i[0]=true;ik.G=0;ie.F=true;uc.c=false;
        int[] pixels=new int[W*H];Arrays.fill(pixels,0x7a5c02);td.a(pixels,W,H);
        lf.a(0,new aj[]{c},-1,H,0,-1,W,0,true,0);
        ByteBuffer raw=ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
        raw.asIntBuffer().put(pixels);frames.write(raw.array());
        System.out.println(c.ob+" "+callbacks+" "+Arrays.stream(pixels).filter(p->p==LINE).count());
    }
    public static void main(String[] args)throws Exception {
        try(var models=new ProceduralTextureCacheOracle.Disk(Path.of(args[0]),7){
                byte[] a(int mode,int group){change();return super.a(mode,group);}
            }; var textures=new ProceduralTextureCacheOracle.Disk(Path.of(args[0]),9);
              var materials=new ProceduralTextureCacheOracle.Disk(Path.of(args[0]),26);
              var sprites=new ProceduralTextureCacheOracle.Disk(Path.of(args[0]),8);
              var frames=new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])))) {
            dc.r=new kg(new al(textures,false,true),new al(materials,true,true),new al(sprites,true,true),20,false);
            var input=new BufferedReader(new InputStreamReader(System.in));
            for(String s;(s=input.readLine())!=null;){String[] v=s.split(" ");run(Integer.parseInt(v[0]),Integer.parseInt(v[1]),models,frames);}
        }
    }
}
