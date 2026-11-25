import java.awt.Component;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import java.util.zip.CRC32;
import jdk.internal.org.objectweb.asm.*;

@SuppressWarnings({"removal","deprecation"})
public class ClientLoadingOracle {
    static class HeadlessApplet extends java.applet.Applet {
        public java.awt.Dimension getSize(){return new java.awt.Dimension(821,526);}
    }
    static String window="";static int heap,gcs; static long clock;
    public static long total(Runtime r){return (long)heap*1024;}
    public static long free(Runtime r){return 0;}
    public static long now(int dummy){return clock;}
    public static void gc(){gcs++;}
    // The JVM peers beyond these two calls open a real sound line and configure the display.
    public static dg player(int frames,fb sign,int channel,int dummy,Component component){return new dg();}
    public static void window(int height,boolean apply,int mode,boolean replace,int width){window=height+","+apply+","+mode+","+replace+","+width;
        if(mode==0){ui.a(height,apply,mode,replace,width);window+=","+hi.f+","+fl.l+","+pa.rb+","+sk.N;}}

    static ArrayList<String> phases=new ArrayList<>();
    static int worldReply=-1;
    static String worldError="";
    public static int worldPoll(int dummy){return worldReply==-1?jb.c(dummy):worldReply;}
    public static void showError(client app,int dummy,String error){worldError=tf.C+"@"+error;}
    public static void note(String op){int dirty=0;for(boolean v:sf.m)if(v)dirty++;phases.add(op+":"+aa.e+":"+(te.g==null?-1:te.g.Z)+":"+dirty);}
    static void prepare(Path jar,Path out)throws Exception{
        try(JarFile source=new JarFile(jar.toFile())){
            ClassReader c=new ClassReader(source.getInputStream(source.getJarEntry("client.class")));ClassWriter w=new ClassWriter(0);
            c.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e){
                    MethodVisitor m=super.visitMethod(a,n,d,s,e);
                    if(!n.equals("f")||!d.equals("(B)V"))return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String o,String n,String d,boolean iface){
                            if(o.equals("java/lang/Runtime")&&(n.equals("freeMemory")||n.equals("totalMemory")))super.visitMethodInsn(Opcodes.INVOKESTATIC,"ClientLoadingOracle",n.equals("totalMemory")?"total":"free","(Ljava/lang/Runtime;)J",false);
                            else if(o.equals("java/lang/System")&&n.equals("gc"))super.visitMethodInsn(op,"ClientLoadingOracle","gc",d,false);
                            else if(o.equals("eh")&&d.equals("(I)J"))super.visitMethodInsn(op,"ClientLoadingOracle","now",d,false);
                            else if(o.equals("lg")&&d.endsWith(")Ldg;"))super.visitMethodInsn(op,"ClientLoadingOracle","player",d,false);
                            else if(o.equals("ui")&&d.equals("(IZIZI)V"))super.visitMethodInsn(op,"ClientLoadingOracle","window",d,false);
                            else if(o.equals("jb")&&n.equals("c")&&d.equals("(I)I"))super.visitMethodInsn(op,"ClientLoadingOracle","worldPoll",d,false);
                            else if(n.equals("a")&&d.equals("(ILjava/lang/String;)V"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"ClientLoadingOracle","showError","(Lclient;ILjava/lang/String;)V",false);
                            else super.visitMethodInsn(op,o,n,d,iface);
                        }
                    };
                }
            },0);Files.write(out.resolve("client.class"),w.toByteArray());
            // Observe the four handoffs in vb.a without replacing the implementations.
            ClassReader title=new ClassReader(source.getInputStream(source.getJarEntry("vb.class")));ClassWriter observed=new ClassWriter(ClassWriter.COMPUTE_MAXS);
            title.accept(new ClassVisitor(Opcodes.ASM8,observed){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] ex){
                    MethodVisitor m=super.visitMethod(a,n,d,s,ex);
                    if(!n.equals("a")||!d.equals("(IZ)V"))return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String o,String n,String d,boolean iface){
                            String tag=null;
                            if(o.equals("gd")&&n.equals("b")&&d.equals("(IB)V"))tag="onLoad";
                            if(o.equals("sc")&&n.equals("a")&&d.equals("(IZ)V"))tag="cursor";
                            if(o.equals("od")&&n.equals("a")&&d.equals("(Lal;I)V"))tag="flames";
                            if(o.equals("ej")&&n.equals("a")&&d.equals("(II)V"))tag="state";
                            if(tag!=null){super.visitLdcInsn(tag);super.visitMethodInsn(Opcodes.INVOKESTATIC,"ClientLoadingOracle","note","(Ljava/lang/String;)V",false);}
                            super.visitMethodInsn(op,o,n,d,iface);
                        }
                    };
                }
            },0);Files.write(out.resolve("vb.class"),observed.toByteArray());
        }
    }
    static final String[] slots="uh.O bc.c sf.b dd.l rg.m re.d al.l rk.k h.i ha.b ek.D gd.E il.B nf.j f.f gj.Z fk.db bh.c ve.e ok.t ml.t ta.M jl.f aa.d kh.B wf.u wh.X ll.g".split(" ");
    static Field fld(String key)throws Exception{String[] n=key.split("\\.");Field f=Class.forName(n[0]).getDeclaredField(n[1]);f.setAccessible(true);return f;}
    static Path cache;static RandomAccessFile dat;static Map<Integer,RandomAccessFile> indexes=new HashMap<>();
    static byte[] read(int archive,int id)throws IOException{
        RandomAccessFile idx=indexes.get(archive);if(idx==null){idx=new RandomAccessFile(cache.resolve("main_file_cache.idx"+archive).toFile(),"r");indexes.put(archive,idx);}
        idx.seek(6L*id);int size=(idx.readUnsignedByte()<<16)|idx.readUnsignedShort(),sector=(idx.readUnsignedByte()<<16)|idx.readUnsignedShort();
        byte[] data=new byte[size];
        for(int pos=0;pos<size;pos+=512){dat.seek(520L*sector);if(dat.readUnsignedShort()!=id||dat.readUnsignedShort()!=pos/512)throw new IOException("sector");sector=(dat.readUnsignedByte()<<16)|dat.readUnsignedShort();if(dat.readUnsignedByte()!=archive)throw new IOException("archive");dat.readFully(data,pos,Math.min(512,size-pos));}
        return data;
    }
    static Object oldComponents,oldTable;static qd priorSub;
    static qk[] priorWorlds,priorSorted;
    static db[] tables=new db[28]; static int blocked,gate,percent;
    static class Source extends ud{
        final int archive;Source(int a){archive=a;}
        db b(int guard){return tables[archive];}
        byte[] a(int mode,int group){
            if((archive==blocked||blocked==-1) && (group&3)>=gate)return null;
            try{return read(archive,group);}catch(IOException e){throw new RuntimeException(e);}
        }
        int c(int group,int guard){return percent;}
        void b(int guard,int group){}
    }
    static void bind()throws Exception{
        for(int i=0;i<28;i++)fld(slots[i]).set(null,new al(new Source(i),false,true));
    }
    static String fontData(mb font)throws Exception {
        StringJoiner out=new StringJoiner(",");
        for(String name:new String[]{"C","bb","hb"})out.add(""+fld("mb."+name).getInt(font));
        for(String name:new String[]{"H","K","P","Y","cb","M"})out.add(""+Arrays.hashCode((int[])fld("mb."+name).get(font)));
        out.add(""+Arrays.hashCode((byte[])fld("mb.R").get(font)));
        out.add(""+Arrays.deepHashCode((byte[][])fld("fg.wb").get(font)));
        return out.toString();
    }
    static String sprites(Object[] values)throws Exception {
        if(values==null)return "-";
        StringJoiner out=new StringJoiner(",");
        for(Object value:values){
            if(value instanceof rh a){
                out.add(""+Arrays.hashCode(new int[]{a instanceof vh?2:1,a.F,a.C,a.B,a.A,a.O,a.D,Arrays.hashCode(a.I)}));
            }else if(value instanceof ch a){
                out.add(""+Arrays.hashCode(new int[]{3,a.b,a.j,a.l,a.n,a.o,a.c,Arrays.hashCode(a.y),Arrays.hashCode((int[])fld("ch.z").get(a))}));
            }else throw new AssertionError(value);
        }
        return out.toString();
    }
    static String spriteData()throws Exception{
        StringJoiner out=new StringJoiner("/");
        for(Object[] group:new Object[][]{vb.d,pe.B,gg.H,oa.c,ph.m,wa.a,cf.e,fe.Y==null?null:new Object[]{fe.Y},
              di.m,ll.r,me.L,ag.k,ff.u==null?null:new Object[]{ff.u},gf.cb})out.add(sprites(group));
        for(mb font:new mb[]{ma.b,wj.g,uf.b})out.add(""+(fld("mb.ib").get(font)==ag.k));
        out.add(""+(vb.d==gh.N));out.add(""+Double.doubleToRawLongBits(Math.random()));
        return out.toString();
    }
    static String state(int stage)throws Exception{
        String extra="-";
        if(stage==0)extra=kj.S+","+jk.H+","+gcs;
        if(stage==10)extra=fld("ke.C").get(hc.c[0])+","+fld("ke.u").get(hc.c[3])+","+Arrays.deepHashCode(hc.c[0].d);
        if(stage==30 && bh.b==40)extra=""+Arrays.stream(lj.h).filter(Objects::nonNull).count();
        if(stage==65)extra=fontData(ma.b)+"/"+fontData(wj.g)+"/"+fontData(uf.b)+"/"+(rg.h==ma.b);
        if(stage==80)extra=spriteData();
        if(stage==130 && bh.b==135)extra=""+(oe.y==vb.d)+","+gl.w.length;
        if(stage==135)extra=tf.C+","+worldError;
        if(stage==110)extra=""+(ej.p!=null);
        if(stage==140){StringBuilder bits=new StringBuilder();for(int a:new int[]{5,6,8,13,10,3}){db table=tables[a];bits.append(table.m==null?"0":"1");bits.append(table.f==null?"0":"1");}extra=ah.n+","+qf.f+","+bits;}
        if(stage==160){
            int dirty=0;for(boolean v:sf.m)if(v)dirty++;
            extra=tf.C+","+hd.m+","+aa.e+","+te.g.Z+","+te.g.S+","+Arrays.stream(fk.ab[hd.m]).filter(Objects::nonNull).count()+","+dirty+","+(fk.ab!=oldComponents)+","+(va.Z!=oldTable)+","+(priorSub==null||priorSub.p==null)+","+String.join("/",phases);
            extra+=","+(ga.G==li.E)+","+(ga.F==qk.E);
            extra+=","+(oc.i==priorWorlds)+","+(ke.y==priorSorted)+","+tf.K+","+wd.g+","+rb.a;
        }
        if(stage==150)extra=oa.j+","+kg.A+","+kf.d+","+aa.h+","+window;
        return bh.b+"|"+ga.D+"|"+Base64.getEncoder().encodeToString(ie.A.b(false))+"|"+we.y+"|"+g.s+"|"+extra;
    }
    public static void main(String[] args)throws Exception{
        if(args[0].equals("prepare")){prepare(Path.of(args[1]),Path.of(args[2]));return;}
        cache=Path.of(args[1]);dat=new RandomAccessFile(cache.resolve("main_file_cache.dat2").toFile(),"r");
        for(int i=0;i<28;i++){byte[] b=read(255,i);CRC32 crc=new CRC32();crc.update(b);tables[i]=new db(b,(int)crc.getValue());}
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");Field uf=unsafe.getDeclaredField("theUnsafe");uf.setAccessible(true);
        client instance=(client)unsafe.getMethod("allocateInstance",Class.class).invoke(uf.get(null),client.class);
        Method load=client.class.getDeclaredMethod("f",byte.class);load.setAccessible(true);
        HeadlessApplet app=(HeadlessApplet)unsafe.getMethod("allocateInstance",Class.class).invoke(uf.get(null),HeadlessApplet.class);
        tj.m=new fb(app,0,null,0);pe.S=new java.awt.Canvas();dg.B=instance;wk.d=new ej();mi.v=null;tf.C=5;
        int language=Integer.parseInt(args[2]);hl.w=language;ii.a((byte)127,language);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));String line;int row=0;byte[] master=new byte[5+8*28];
        try{
            while((line=in.readLine())!=null&&!line.isEmpty()){
                String[] p=line.split(" ");int stage=Integer.parseInt(p[0]);bh.b=stage;blocked=Integer.parseInt(p[1]);gate=Integer.parseInt(p[2]);percent=Integer.parseInt(p[3]);int flag=Integer.parseInt(p[4]);
                we.y=(flag&1)!=0;g.s=0;ob.C=(flag>>1)&3;ak.f[0]=120;ak.f[1]=(flag&8)!=0?115:83;ak.f[2]=33;
                if(stage==0){heap=blocked;clock=gate;kj.S=1000;jk.H=500;gcs=0;}
                if(stage==30 && percent==100){fd request=(fd)fld("wi.l").get(mi.v);request.P=new gd(master);request.P.yb=master.length;request.D=false;}
                if(stage>=40){
                    if(stage==40)for(int i=0;i<28;i++)fld("mc.G").set(lj.h[i],i<percent?tables[i]:null);
                    bind();
                }
                if(stage==80){
                    Field rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
                    rng.setAccessible(true);((Random)rng.get(null)).setSeed(260000000L+language*13+gate);
                }
                if(stage==135){tf.C=5;worldError="";worldReply=blocked;wd.g=percent==0?1:0;s.O=percent!=0;kc.i=ga.I=eh.a(19644);f.k=new dj();}
                if(stage==160){
                    ga.G=li.E;ga.F=qk.E;
                    oc.i=priorWorlds=new qk[]{new qk()};ke.y=priorSorted=priorWorlds.clone();tf.K=1;wd.g=3;rb.a=2;
                    phases.clear();te.g=null;aa.e=42;Arrays.fill(sf.m,false);oldTable=va.Z;oldComponents=fk.ab;priorSub=null;
                    if(percent==1){priorSub=new qd();priorSub.v=2;priorSub.q=1;va.Z.a((byte)-89,priorSub,(long)ah.n<<16);}
                }
                if(stage==150){window="";oa.j=2;kg.A=3;kf.d=4;aa.h=2;}
                try{load.invoke(instance,(byte)110);}catch(InvocationTargetException ex){System.err.println("row "+row+" command "+line);throw ex;}
                System.out.println(state(stage));row++;
                if(stage==110)ej.p.h=false;
            }
        }finally{tj.m.a(15);dat.close();for(RandomAccessFile i:indexes.values())i.close();}
    }
}
