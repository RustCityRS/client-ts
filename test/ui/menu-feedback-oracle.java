import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Exercise oi.b(B)V and ii.a(ILaj;IB)V on td's real software framebuffer.
class MenuFeedbackOracle {
    static final int W=96, H=72;
    static int choice, occurrence, seen;
    static boolean substitute;
    static StringBuilder trace;
    static final String[] reads={"uf.b","bi.i","ei.s","ed.g","sj.C","pf.Q","fl.i","hc.j","lk.u","client.C"};
    static void read(int site) {
        if (choice < 0) return;
        trace.append(site);
        if (choice!=site || ++seen!=occurrence) return;
        if(!substitute) throw new ArrayIndexOutOfBoundsException();
        switch(site){
            case 0:uf.b=font(1);break;case 1:bi.i=new Random(-443);break;case 2:ei.s++;break;
            case 3:ed.g=new int[]{10,11,12,13};break;case 4:sj.C++;break;case 5:pf.Q++;break;
            case 6:fl.i++;break;case 7:hc.j++;break;case 8:lk.u++;break;case 9:client.C++;break;
        }
    }
    static void prepare(Path file,Path dir)throws Exception {
        try(JarFile jar=new JarFile(file.toFile())) {
            for(String owner:new String[]{"oi","ii"}){
                ClassReader r=new ClassReader(jar.getInputStream(jar.getJarEntry(owner+".class")));
                ClassWriter w=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                r.accept(new ClassVisitor(Opcodes.ASM8,w){
                    public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions){
                        MethodVisitor m=super.visitMethod(access,name,desc,signature,exceptions);
                        if(!name.equals(owner.equals("oi")?"b":"a") || !desc.equals(owner.equals("oi")?"(B)V":"(ILaj;IB)V"))return m;
                        return new MethodVisitor(Opcodes.ASM8,m){
                            public void visitFieldInsn(int op,String cls,String field,String fieldType){
                                int site=Arrays.asList(reads).indexOf(cls+"."+field);
                                if(op==Opcodes.GETSTATIC&&site>=0){
                                    super.visitIntInsn(Opcodes.BIPUSH,site);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"MenuFeedbackOracle","read","(I)V",false);
                                }
                                super.visitFieldInsn(op,cls,field,fieldType);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),w.toByteArray());
            }
        }
    }
    static id word(String value) { byte[] bytes=value.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1); return ea.a(bytes,0,bytes.length,0); }
    static fg font(int style) {
        byte[] metrics=new byte[257]; Arrays.fill(metrics,(byte)(4+style)); metrics[256]=(byte)(6+style);
        int[] x=new int[256],y=new int[256],w=new int[256],h=new int[256]; byte[][] masks=new byte[256][];
        for(int i=0;i<256;i++) {
            x[i]=(i+style)%2; y[i]=1; w[i]=3+style; h[i]=4+style; masks[i]=new byte[w[i]*h[i]];
            for(int k=0;k<masks[i].length;k++) masks[i][k]=(byte)((i+3*k+style)%5<3?1:0);
        }
        return new fg(metrics,x,y,w,h,masks);
    }
    static String bools(boolean[] rows) {
        if(rows==null)return "-";
        StringBuilder out=new StringBuilder(); for(boolean b:rows) out.append(b?'1':'0'); return out.toString();
    }
    static String run(int[] a) {
        int kind=a[0], count=a[1], x=a[2], y=a[3], width=a[4], height=a[5], seed=a[10], fault=a[13];
        fl.i=x; hc.j=y; lk.u=width; client.C=height; vb.o=count; sj.C=a[6]; pf.Q=a[7];
        ak.a=new id[]{word("Walk"),word("Take"),word("Read"),word("Try"),null};
        ph.e=new id[]{word(""),word("Coin"),word("<col=22bbda>Caf\u00e9</col>"),word("Box"),word("")};
        si.q=word("Choose Option"); ae.i=word(" more"); le.f=word("Use"); ge.Z=word("Key"); t.W=word("Cast"); al.s=word("Fire");
        le.c=a[11]==1?1:0; ok.r=a[11]==2; pb.sc=a[11]==3; ob.q=new boolean[112]; ob.q[81]=pb.sc;
        uf.b=font(0); cf.f=new ve(20); cf.f.a(23L,font(1),(byte)-71); rk.o=true;
        aj widget=null;
        if(a[8]!=-2) {
            widget=new aj(); widget.mc=a[8];widget.C=width;widget.H=height;widget.oc=0xb54472;widget.Dc=0x31230a;
            widget.bb=a[9]/4;widget.Jb=a[9]%4;
        }
        bi.i=new Random(1987);ei.s=seed;
        int[] bounds={-13,-11,-9,-7}; ed.g=bounds;
        nh.Y=new int[]{0,10,43,60,80,18,-8};r.U=new int[]{0,11,4,52,63,32,16};
        gk.i=new int[]{7,46,15,10,25,19,16};ik.Q=new int[]{7,31,13,16,27,8,12};ik.G=7;
        ce.T=new boolean[7];ce.T[5]=true; sf.m=new boolean[7];sf.m[6]=true;
        int[] pixels=new int[W*H]; for(int k=0;k<pixels.length;k++) pixels[k]=(0x327019 ^ k*0x778251) & 0xffffff;
        td.a(pixels,W,H);
        if(a[12]==1)td.b(7,13,41,49); else if(a[12]==2)td.b(21,23,21,23);
        switch(fault) {
            case 1: uf.b=null; break;
            case 2: ph.e=null; break;
            case 3: ph.e=Arrays.copyOf(ph.e,1); break;
            case 4: ak.a=Arrays.copyOf(ak.a,1); break;
            case 5: ph.e[0]=null; break;
            case 6: ce.T=new boolean[1]; sf.m=new boolean[1]; break;
            case 7: gk.i=new int[]{7,46}; break;
            case 8: ed.g=null; break;
            case 9: ed.g=new int[]{-13,-11}; break;
            case 10: bi.i=null; break;
            case 11: rk.o=false; break;
            case 12: si.q=null; break;
        }
        Random initialRandom=bi.i;mb initialFont=uf.b;
        choice=fault<100?-1:(fault-100)/10;occurrence=fault%10;seen=0;substitute=a[11]==4;trace=new StringBuilder();
        String status="ok";
        try { if(kind==0) oi.b((byte)-2); else ii.a(x,widget,y,(byte)115); }
        catch(RuntimeException e) {
            Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
            status=cause instanceof ArrayIndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":cause.getClass().getSimpleName();
        }
        ByteBuffer raster=ByteBuffer.allocate(pixels.length*4); for(int pixel:pixels) raster.putInt(pixel);
        String state=String.join("/", status,bools(ce.T),bools(sf.m),Arrays.toString(ed.g),""+rk.o,
            bi.i==null?"-":""+bi.i.nextInt(),""+(ed.g==bounds),""+(initialRandom==bi.i),""+(initialFont==uf.b),trace.toString());
        return state+"|"+Base64.getEncoder().encodeToString(raster.array());
    }
    public static void main(String[] args) throws Exception {
        if(args.length>0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;) System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
