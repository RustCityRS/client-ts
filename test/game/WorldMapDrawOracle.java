import java.io.*;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

class WorldMapDrawOracle {
    static Method mainProbe, overviewProbe;
    static String point;
    static int memoryKb;
    public static long totalMemory(Runtime runtime) { return (1L + memoryKb) * 1024L; }
    public static long freeMemory(Runtime runtime) { return 1024L; }
    static StringJoiner calls;
    public static void hit(String site) {
        calls.add(site);
        if (site.equals(point)) throw new IllegalStateException("boundary");
        if (site.equals("tiles") && point.equals("swapFb")) {
            wc replacement=new wc();replacement.i=333;replacement.e=112;
            replacement.n=new int[333*112+1];Arrays.fill(replacement.n,0x215167);
            rg.s=replacement;
        }
    }
    static void probes() throws Exception {
        ClassWriter out = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        out.visit(Opcodes.V1_6,Opcodes.ACC_PUBLIC,"MapDrawBoundaries",null,"java/lang/Object",null);
        for (String owner : new String[]{"ah","oc"}) {
            var original = new ClassNode();
            new ClassReader(WorldMapDrawOracle.class.getResourceAsStream("/"+owner+".class")).accept(original,0);
            String desc = owner.equals("ah") ? "(IIIII)V" : "(IBIII)V";
            for (MethodNode m : original.methods) if(m.name.equals("a") && m.desc.equals(desc)) {
                for (var ins : m.instructions.toArray()) if(ins instanceof MethodInsnNode op) {
                    if(op.owner.equals("java/lang/Runtime") && (op.name.equals("totalMemory") || op.name.equals("freeMemory"))) {
                        m.instructions.set(ins,new MethodInsnNode(Opcodes.INVOKESTATIC,"WorldMapDrawOracle",op.name,"(Ljava/lang/Runtime;)J",false));
                        continue;
                    }
                    String site = switch(op.owner){
                        case "jf" -> "tiles"; case "mj" -> "scaled"; case "ik" -> "labels";
                        case "lg" -> "step"; case "oh" -> "bind"; case "vc" -> "opaque"; default -> null;
                    };
                    if (site != null) {
                        var hook = new InsnList(); hook.add(new LdcInsnNode(site));
                        hook.add(new MethodInsnNode(Opcodes.INVOKESTATIC,"WorldMapDrawOracle","hit","(Ljava/lang/String;)V",false));
                        m.instructions.insertBefore(ins,hook);
                    }
                }
                m.name=owner;m.access=Opcodes.ACC_STATIC|Opcodes.ACC_PUBLIC;m.accept(out);
            }
        }
        out.visitEnd();
        Class<?> probe = MethodHandles.lookup().defineClass(out.toByteArray());
        mainProbe=probe.getDeclaredMethod("ah",int.class,int.class,int.class,int.class,int.class);
        overviewProbe=probe.getDeclaredMethod("oc",int.class,byte.class,int.class,int.class,int.class);
    }
    static String hash(int[] values) throws Exception {
        if(values==null)return "-";
        var data=ByteBuffer.allocate(values.length*4);
        for(int value:values)data.putInt(value);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.array()));
    }
    static String result(Throwable t) {
        if(t instanceof InvocationTargetException)return result(t.getCause());
        if(t instanceof g w)return w.q+"/"+result(w.a);
        if(t instanceof NullPointerException)return "null";
        if(t instanceof ArithmeticException)return "zero";
        if(t instanceof IndexOutOfBoundsException)return "bounds";
        if(t instanceof ClassCastException)return "cast";
        if(t instanceof IllegalStateException)return "boundary";
        return t.getClass().getSimpleName();
    }
    static String widgetState(aj item, aj parent, aj spare) {
        return item.vb+","+item.R+","+parent.vb+","+parent.R+","+spare.vb+","+spare.R+","+ik.G+";"+
            Arrays.toString(nh.Y)+";"+Arrays.toString(r.U)+";"+Arrays.toString(gk.i)+";"+Arrays.toString(ik.Q)+";"+
            Arrays.toString(sf.m)+";"+Arrays.toString(ce.T);
    }
    static void map(int mode,int progress) {
        sa.w=progress;rk.h=progress<100?null:new gh(null,null,0,0,0x426722,true,50);
        ki.db=24;ml.m=18;c.C=12;sg.b=8;oi.a=od.P=0;
        cl.w=4;rc.g=6;vb.f=10;uj.d=8;
        tb.w=new int[1][1][4096];af.J=new byte[1][1][4096];mg.o=new byte[1][1][4096];
        hc.f=new byte[1][1][4096];fl.g=new byte[1][1][4096];hh.ob=new byte[1][1][4096];
        qj.L=new int[1][1][];ai.a=new int[1][1][];pa.wb=new int[]{0,0xc48516,0x1961af};
        for(int i=0;i<4096;i++){
            tb.w[0][0][i]=1+(0x396941+i*0x10507&0xffffff);
            if(i%5==1){af.J[0][0][i]=1;mg.o[0][0][i]=(byte)(4+(i%38));}
            if(i%11==5){hc.f[0][0][i]=2;fl.g[0][0][i]=(byte)(4+(i%19));}
            if(i%19==11)hh.ob[0][0][i]=(byte)(i%28+1);
        }
        jg.t=new kc(0);rf.v=new gk();ad.a=new gk();
        for(int i=0;i<4;i++){mi icon=new mi();icon.s=i%2;icon.F=3+4*i;icon.z=2+2*i;rf.v.a(icon,false);}
        ij.l=1;jg.C=mode>=12 && mode<=14;
        if(mode==4)tb.w=null;
        if(mode==5)jg.t=null;
        if(mode==6)rf.v.a(new jf(),false);
        if(mode==10)ki.db=0;
        if(mode==11)ml.m=0;
    }
    static void run(String line) throws Exception {
        var s=line.split(" ");int[] v=new int[13];for(int i=0;i<v.length;i++)v[i]=Integer.parseInt(s[i]);
        int entry=v[0],mode=v[8],w=v[4],h=v[5],x=v[6],y=v[7],screenW=333,screenH=112;
        map(mode,v[1]);hd.h=Float.intBitsToFloat(v[2]);int scale=v[3];hh.sb=v[9];hd.n=v[10];jl.c=v[11];
        uf.b=mode==8?null:TitleLoadingOracle.font;
        wj.g=mode==14?null:TitleLoadingOracle.font;
        dd.a=49;memoryKb=mode==13?65537:65536;
        int[] screen=new int[mode==7?135:screenW*screenH+1];for(int i=0;i<screen.length;i++)screen[i]=0x14375+i*3721;
        wc fb=new wc();fb.n=screen;fb.i=screenW;fb.e=screenH;rg.s=mode==3?null:fb;fb.b(0);
        gh.M=null;
        if(mode==15){
            var sprite=new rh(w+11,h+9,3,4,w,h,new int[w*h]);Arrays.fill(sprite.I,0x6633cc);gh.M=sprite;
        }else if(mode==1||mode==2||mode==6||mode==10||mode==11||mode==16){
            rh sprite=new rh(w+(mode==2?1:0),h+(mode==16?1:0));
            for(int i=0;i<sprite.I.length;i++)sprite.I[i]=0x3e4470+i*59;
            gh.M=sprite;
        }
        point=s[13];calls=new StringJoiner(",");
        int previousCalls=0;
        for(int rep=0;rep<v[12];rep++){
            vc before=gh.M;String error="-";String widget="-";
            aj component=new aj(),parent=new aj(),spare=new aj();
            try {
                if(entry==0)ah.a(y,scale,x,h,w);
                else if(entry==1)oc.a(x,(byte)20,y,h,w);
                else if(entry==2)mainProbe.invoke(null,y,scale,x,h,w);
                else if(entry==3)overviewProbe.invoke(null,x,(byte)20,y,h,w);
                else {
                    hh.kb=7890+rep;
                    ik.G=7;nh.Y=new int[12];r.U=new int[12];gk.i=new int[12];ik.Q=new int[12];
                    sf.m=new boolean[12];ce.T=new boolean[12];sf.m[5]=ce.T[9]=true;
                    if(mode==17)ce.T=new boolean[7];
                    if(mode==18)sf.m=null;
                    if(mode==22)r.U=new int[7];
                    if(mode==23){rk.h=new gh(null,null,0,0,0x426722,true,50);he.y=null;}
                    component.n=-1;component.ob=3;component.ib=x;component.Mb=y;component.C=w;component.H=h;component.wc=entry==4?1400:1401;
                    component.vb=parent.vb=spare.vb=-11;component.R=parent.R=spare.R=-12;
                    component.y=true;component.Wc=mode==19;
                    if(mode==20)component.ib=screenW+3;
                    aj[] widgets={component};
                    if(mode==21||mode==24){
                        parent.n=-1;parent.Kc=853;parent.ob=0;parent.y=true;parent.ib=3;parent.Mb=7;parent.C=38;parent.H=31;
                        spare.n=-1;spare.y=true;spare.Wc=true;spare.ob=3;spare.ib=1;spare.Mb=2;spare.C=11;spare.H=7;
                        component.n=853;widgets=new aj[]{spare,parent,component};
                        if(mode==24)ce.T=new boolean[8];
                    }
                    lf.a(0,widgets,-1,screenH,0,-1,screenW,0,true,0);
                }
            }catch(Throwable t){error=result(t);}
            if(entry>=4)widget=widgetState(component,parent,spare);
            String trace=calls.toString();String currentCalls=trace.substring(previousCalls);
            if(currentCalls.startsWith(","))currentCalls=currentCalls.substring(1);
            previousCalls=trace.length();
            int[] cached=gh.M==null?null:((rh)gh.M).I;
            String bind=td.g==screen?"screen":td.g==cached?"cache":"other";
            System.out.println(String.join("|",error,currentCalls,widget,
                td.e+","+td.b+","+td.h+","+td.d+","+td.c+","+td.i,
                rc.g+","+cl.w+","+vb.f+","+uj.d+","+hh.sb+","+hd.n,
                (before==gh.M)+","+(gh.M!=null)+","+bind,
                hash(screen),hash(cached),hash(td.g)));
        }
    }
    static void frames() {
        aj widget=new aj();widget.y=true;widget.n=-1;widget.ob=3;widget.wc=1401;
        widget.ib=3;widget.Mb=2;widget.C=7;widget.H=9;
        fk.ab=new aj[][]{{widget}};rg.b=new boolean[]{true};hd.m=0;
        ik.G=2;sf.m=new boolean[]{false,true,false};ce.T=new boolean[3];n.i=new boolean[3];
        nh.Y=new int[3];r.U=new int[3];gk.i=new int[3];ik.Q=new int[3];
        sa.w=0;rk.h=null;hi.f=17;fl.l=15;
        td.a(new int[17*15+1],17,15);te.g=new pb();ig.t=-1;aa.e=-1;qh.c=-1;
        for(int i=0;i<6;i++){
            hh.kb=220+i;widget.Wc=i==2||i==3;
            if(i%2==0)db.a(-54);else gf.e((byte)120);
            System.out.println(widget.vb+","+widget.R+","+ik.G+","+vk.db+";"+Arrays.toString(sf.m)+";"+
                Arrays.toString(ce.T)+";"+Arrays.toString(n.i));
            for(int root=0;root<ik.G;root++)ce.T[root]=false;
        }
    }
    public static void main(String[] args)throws Exception {
        Class.forName("client");probes();TitleLoadingOracle.directory=Path.of(args[0]);TitleLoadingOracle.perform(new String[]{"init"});
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(String line; (line=in.readLine())!=null;){if(line.equals("frames"))frames();else run(line);}
    }
}
