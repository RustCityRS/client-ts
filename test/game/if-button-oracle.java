import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Run bd.a(Lid;IIII)V unchanged between call boundaries. These four adapters execute
// the original VM or packet method, then permit one controlled change to a live global.
class IfButtonOracle {
    static final int ID=65537, SCRIPT=61234;
    static aj parent,child;
    static be a,b;
    static StringBuilder writes;
    static String hook,paused;
    static int hookMode,mutation,switchAt,swap;
    static Object[] args;
    static id base;
    static java.lang.reflect.Field cipher;

    static String hex(id value){return value==null?"~":HexFormat.of().formatHex(value.A,0,value.c);}
    static String owner(gd packet){return packet==null?"N":packet==a?"A":"B";}
    static String packet(be p) throws Exception {
        ij isaac=(ij)cipher.get(p);
        return p.yb+"."+(p.fb==null?"~":HexFormat.of().formatHex(p.fb))+"."+(isaac==null?"~":isaac.b((byte)107));
    }
    static void changed(int write){
        if(switchAt!=write && switchAt!=-1)return;
        switch(swap){
            case 1:qk.v=qk.v==a?b:a;break;
            case 2:qk.v=null;break;
            case 3:qk.v.fb=null;break;
            case 4:qk.v.yb=-1;break;
        }
    }
    public static void head(be p,int dummy,int opcode){Objects.requireNonNull(p);writes.append(owner(p)).append("h");p.k(dummy,opcode);changed(1);}
    public static void word(gd p,int value,int dummy){Objects.requireNonNull(p);writes.append(owner(p)).append("w");p.h(value,dummy);changed(2);}
    public static void half(gd p,int dummy,int value){Objects.requireNonNull(p);writes.append(owner(p)).append("s");p.i(dummy,value);changed(3);}

    public static void onHook(wf e,int dummy) {
        if(hookMode>0)hook=(e.C==child?"C":"P")+"."+(e.G==args)+"."+(e.z==base)+"."+e.y;
        li.a(e,dummy);
        if(hookMode==2)paused=ia.l+"."+od.U[115]+"."+hex(me.a[116])+"."+a.yb+"."+b.yb;
        switch(mutation){
            case 1:e.C.Sc=new l(0,-1);break;
            case 2:e.C.wc=205;break;
            case 3:e.C.wc=42;break;
            case 4:e.C.Sc=new l(0,-1);fd.W.a((byte)-89,new l(-1,-1),((long)e.C.Kc<<32)+e.C.bc);break;
            case 5:parent.pb[2]=new aj();fk.ab[1][1]=new aj();break;
            case 6:e.C.Sc=null;break;
            case 7:qk.v=b;break;
            case 8:fd.W=null;break;
            case 9:qk.v=null;break;
        }
    }
    static void prepare(Path jar,Path dir)throws Exception{
        try(JarFile source=new JarFile(jar.toFile())){
            ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry("bd.class")));
            ClassWriter out=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] errors){
                    MethodVisitor mv=super.visitMethod(access,name,desc,signature,errors);
                    if(!name.equals("a")||!desc.equals("(Lid;IIII)V"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf){
                            if(op==Opcodes.INVOKESTATIC && owner.equals("li") && name.equals("a") && desc.equals("(Lwf;I)V")){
                                super.visitMethodInsn(op,"IfButtonOracle","onHook",desc,false);return;
                            }
                            String method=switch(owner+"."+name+desc){
                                case "be.k(II)V"->"head"; case "gd.h(II)V"->"word"; case "gd.i(II)V"->"half";default->null;};
                            if(method!=null){super.visitMethodInsn(Opcodes.INVOKESTATIC,"IfButtonOracle",method,"(L"+owner+";II)V",false);return;}
                            super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("bd.class"),out.toByteArray());
        }
    }
    static be init(int capacity,int pos,boolean seeded,int seed) {
        be p=new be(Math.max(0,capacity)); if(capacity<0)p.fb=null;else Arrays.fill(p.fb,(byte)0xa5);
        p.yb=pos;if(seeded)p.a(new int[]{seed,2,3,4},0);return p;
    }
    public static void main(String[] argv)throws Exception{
        if(argv.length!=0){prepare(Path.of(argv[0]),Path.of(argv[1]));return;}
        cipher=be.class.getDeclaredField("Jb");cipher.setAccessible(true);
        m code=new m();code.E=1;code.I=1;code.D=new int[]{33,43,35,48,21};code.F=new int[]{0,115,0,116,0};code.B=new id[5];
        sf.g.a((long)SCRIPT,0,code);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            int[] r=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op=r[0],slot=r[1],flags=r[2],codeId=r[3];hookMode=r[4];mutation=r[5];switchAt=r[6];swap=r[7];
            a=init(r[8],r[10],(r[11]&1)==0,1);b=init(r[9],r[12],(r[11]&2)==0,12);
            qk.v=(r[11]&4)!=0?null:a;fd.W=new nc(32);ia.l=-12;
            parent=new aj();child=new aj();parent.pb=new aj[]{null,null,child};fk.ab=new aj[][]{null,new aj[]{null,parent}};rg.b=new boolean[]{false,true};
            parent.Kc=child.Kc=ID;parent.bc=-1;child.bc=2;
            parent.wc=child.wc=codeId;parent.Sc=child.Sc=(r[11]&8)!=0?null:new l(flags,-1);
            args=new Object[]{SCRIPT,-2147483644,vb.a("event_opbase",(byte)42)};
            if(hookMode>=0)parent.N=child.N=args;
            base=(r[11]&16)!=0?null:vb.a("Inspect",(byte)56);
            if((r[11]&32)!=0)parent.pb=null;
            if((r[11]&64)!=0)fd.W=null;
            od.U[115]=-97;me.a[116]=vb.a("seed",(byte)91);
            writes=new StringBuilder();hook=paused="-";String fault="ok";
            try{bd.a(base,10,slot,ID,op);}
            catch(RuntimeException e){Throwable t=e;while(t instanceof g wrap)t=wrap.a;
                if(t instanceof NullPointerException)fault="null";else if(t instanceof IndexOutOfBoundsException)fault="bounds";else throw e;}
            System.out.println(String.join(";",fault,writes,hook,paused,""+ia.l,""+od.U[115],hex(me.a[116]),owner(qk.v),packet(a),packet(b)));
        }
    }
}
