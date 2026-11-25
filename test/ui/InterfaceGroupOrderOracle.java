import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public final class InterfaceGroupOrderOracle {
    static al a, b;
    static db realIndex;
    static byte[] realGroup;
    static aj parent, child, inventory, subject;
    static aj[][] old, other;
    static aj[] first, second;
    static boolean[] flags, altFlags;
    static IdentityHashMap<Object,Integer> ids;
    static String watch, action, payload, operation;
    static int occurrence, hits;
    static StringJoiner calls;
    static final List<aj> decoded=new ArrayList<>();
    static final class Stop extends Error {}

    static final class Provider extends ud {
        final String name;
        Provider(String name) { this.name = name; }
        db b(int dummy) { callback(name, "index"); return realIndex; }
        byte[] a(int mode, int group) { callback(name, "group"); return realGroup; }
        void b(int dummy, int group) { throw new AssertionError(); }
        int c(int dummy, int group) { throw new AssertionError(); }
    }
    static int id(Object value) {
        return value == null ? 0 : ids.computeIfAbsent(value, ignored -> ids.size() + 1);
    }
    public static void read(String field) {
        if (!field.equals(watch) || ++hits != occurrence) return;
        switch (action) {
            case "stop" -> throw new Stop();
            case "archiveB" -> kh.A = b;
            case "archiveNull" -> kh.A = null;
            case "outerB" -> fk.ab = other;
            case "outerNull" -> fk.ab = null;
            case "outerShort" -> fk.ab = new aj[1][];
            case "rowB" -> fk.ab[1] = second;
            case "rowNull" -> fk.ab[1] = null;
            case "rowShort" -> fk.ab[1] = new aj[0];
            case "flagsB" -> rg.b = altFlags;
            case "flagsShort" -> rg.b = new boolean[1];
            case "kidsShort" -> parent.pb = new aj[0];
            case "kidsNull" -> parent.pb = null;
            case "keep" -> parent.ob = 2;
            case "parentId" -> subject.n = (1 << 16) + 2;
            default -> throw new AssertionError(action);
        }
    }
    static void callback(String owner, String op) {
        calls.add(owner + op);
        read(op);
    }
    static String name(al self) { return Objects.requireNonNull(self) == a ? "a" : "b"; }
    public static int limit(al self, int dummy) {
        callback(name(self), "limit");
        if (payload.equals("real")) return self.b(dummy);
        if (payload.equals("negative")) return -1;
        return self == a ? 3 : 5;
    }
    public static boolean ready(al self, byte dummy, int group) {
        callback(name(self), "ready");
        if (payload.equals("real")) return self.b(dummy, group);
        return !payload.equals("waiting");
    }
    public static int capacity(al self, int group, int dummy) {
        callback(name(self), "cap");
        if (payload.equals("real")) return self.c(group, dummy);
        if (payload.equals("zero")) return 0;
        if (payload.equals("negative")) return -1;
        return self == a ? 3 : 2;
    }
    public static byte[] fetch(al self, int dummy, int file, int group) {
        callback(name(self), "fetch" + file);
        if (payload.equals("real")) return self.a(dummy, file, group);
        if (file == 1 && payload.equals("missing")) return null;
        if (file == 1 && payload.equals("empty")) return new byte[0];
        if (file == 1 && payload.equals("if3")) return new byte[]{-1, 3, 0, 75};
        if (file == 1 && payload.equals("if1")) return new byte[]{3, 0, 0, 53, 1};
        byte[] data = new byte[160];
        data[0] = 3;
        data[3] = (byte)((self == a ? 10 : 50) + file);
        return data;
    }
    public static void discard(al self, int group, byte dummy) {
        callback(name(self), "release");
        if (payload.equals("real")) self.a(group, dummy);
    }
    static void entering(aj widget, String format) {
        int group=widget.Kc >> 16, file=widget.Kc & 65535;
        aj[] row=fk.ab!=null && group>=0 && group<fk.ab.length ? fk.ab[group] : null;
        boolean published=row!=null && file<row.length && row[file]==widget;
        boolean loaded=rg.b!=null && group>=0 && group<rg.b.length && rg.b[group];
        calls.add(format+widget.Kc+":"+(published?1:0)+":"+(loaded?1:0));
        decoded.add(widget);
        read("decode"+file);
    }
    public static void decode1(aj widget, int dummy, gd packet) {
        entering(widget,"if1");widget.a(dummy,packet);
    }
    public static void decode3(aj widget, int dummy, gd packet) {
        entering(widget,"if3");widget.b(dummy,packet);
    }

    // Observer callbacks leave all original stack values in place. A JS5 call
    // is forwarded to a controlled archive boundary, or to al itself in real mode.
    static void instrument(Path out, String owner, String method, String descriptor) throws Exception {
        ClassReader reader;
        try (var in=InterfaceGroupOrderOracle.class.getResourceAsStream("/"+owner+".class")) { reader=new ClassReader(in); }
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int access,String n,String d,String sig,String[] ex) {
                var orig=super.visitMethod(access,n,d,sig,ex);
                if (!n.equals(method) || !d.equals(descriptor)) return orig;
                return new MethodVisitor(Opcodes.ASM8, orig) {
                    public void visitFieldInsn(int op,String o,String n,String d) {
                        String label = switch(o+"."+n) {
                            case "kh.A" -> "archive"; case "fk.ab" -> "outer"; case "rg.b" -> "flags";
                            case "aj.ob" -> "type"; case "aj.pb" -> "kids"; case "aj.n" -> "parentId"; default -> null;
                        };
                        if (label!=null && (op==Opcodes.GETSTATIC || op==Opcodes.GETFIELD)) {
                            super.visitLdcInsn(label);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceGroupOrderOracle","read","(Ljava/lang/String;)V",false);
                        }
                        super.visitFieldInsn(op,o,n,d);
                    }
                    public void visitMethodInsn(int op,String o,String n,String d,boolean itf) {
                        if (o.equals("al")) {
                            String method=switch(n+d) {
                                case "b(I)I" -> "limit"; case "b(BI)Z" -> "ready"; case "c(II)I" -> "capacity";
                                case "a(III)[B" -> "fetch"; case "a(IB)V" -> "discard"; default -> throw new AssertionError(n+d);
                            };
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceGroupOrderOracle",method,"(Lal;"+d.substring(1),false);
                        } else if(o.equals("aj") && d.equals("(ILgd;)V")) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceGroupOrderOracle",n.equals("a")?"decode1":"decode3","(Laj;ILgd;)V",false);
                        } else super.visitMethodInsn(op,o,n,d,itf);
                    }
                };
            }
        },0);
        Files.write(out.resolve(owner+".class"),writer.toByteArray());
    }
    static void setup(String shape) {
        a=new al(new Provider("a"),false,true); b=new al(new Provider("b"),false,true);
        h.f=kk.R=pb.nc=b; kh.A=a;
        parent=new aj(); parent.Kc=17; parent.ob=3;
        child=new aj(); child.Kc=23; child.ob=1;
        inventory=new aj(); inventory.Kc=37; inventory.ob=2;
        parent.pb=new aj[]{child,null,parent};
        first=new aj[3]; second=new aj[]{child,null,inventory};
        fk.ab=old=new aj[][]{null,first,null}; other=new aj[][]{null,second,null};
        rg.b=flags=new boolean[3]; altFlags=new boolean[]{true,false,true};
        switch(shape) {
            case "null" -> old[1]=null;
            case "short" -> old[1]=new aj[1];
            case "parent" -> first[0]=parent;
            case "mixed" -> { first[0]=parent; first[2]=inventory; flags[1]=true; }
            case "drop" -> { first[0]=parent; first[1]=child; flags[1]=true; }
            case "flag" -> { old[1]=null; flags[1]=true; }
            case "noFlags" -> rg.b=null;
            case "noOuter" -> fk.ab=null;
            case "zeroOuter" -> fk.ab=new aj[0][];
            case "noArchive" -> kh.A=null;
        }
        ids=new IdentityHashMap<>();
        for (Object v:new Object[]{a,b,old,other,first,second,flags,altFlags,parent,child,inventory,parent.pb}) id(v);
        calls=new StringJoiner(","); decoded.clear(); hits=0;
    }
    static String widget(aj c) {
        if(c==null)return "-";
        return id(c)+":"+c.Kc+":"+c.ob+":"+(c.y?1:0)+":"+c.wc+":"+c.G;
    }
    static String row(aj[] r) {
        if (r==null) return "-";
        int rowId=id(r);
        var s=new StringJoiner(","); for (int i=0;i<Math.min(4,r.length);i++)s.add(widget(r[i]));
        return rowId+":"+r.length+"["+s+"]";
    }
    static String outer(aj[][] o) {
        return o==null?"-":id(o)+":"+o.length+":"+(o.length>1?row(o[1]):"-");
    }
    static String flags(boolean[] f) {
        return f==null?"-":id(f)+":"+f.length+":"+(f.length>1&&f[1]?1:0);
    }
    static String run(String[] v) {
        setup(v[1]); operation=v[0]; payload=v[2]; watch=v[3]; occurrence=Integer.parseInt(v[4]); action=v[5];
        int group=Integer.parseInt(v[6]),arg=Integer.parseInt(v[7]); String result="ok";
        if(operation.equals("parent")) {
            subject=new aj();subject.Kc=(group << 16)+12;subject.n=arg==0 ? group << 16 : -1;
            va.Z=new nc(8);
            if(arg==2 || arg==3) {
                qd sub=new qd();sub.v=arg==2 ? group & 65535 : group + 1;
                va.Z.a((byte)-89,sub,(5L<<32)+(1<<16));
            } else if(arg==4) va.Z.a((byte)-89,new jf(),3L);
        }
        try {
            switch(operation) {
                case "init" -> wf.a(a,b,true,b,a);
                case "reset" -> ki.f(12860);
                case "load","allocate" -> result=""+qg.a(group,operation.equals("allocate"));
                case "get" -> result="id"+id(ad.a((byte)110,(group<<16)+arg));
                case "child" -> result="id"+id(pj.a(arg,18062,group<<16));
                case "unload" -> ra.a(group,-556);
                case "parent" -> result="id"+id(wb.a(subject,(byte)-70));
                default -> throw new AssertionError(operation);
            }
        } catch(Stop e){result="stop";}
          catch(RuntimeException e) {
            Throwable t=e;
            while(t instanceof g && ((g)t).a!=null) t=((g)t).a;
            result=t instanceof IndexOutOfBoundsException?"bounds":t instanceof NullPointerException?"null":
                t instanceof NegativeArraySizeException?"size":t.getClass().getSimpleName();
        }
        String state=String.join(";",result,""+hits,calls.toString(),id(kh.A)+","+id(h.f)+","+id(kk.R)+","+id(pb.nc),
            outer(fk.ab),outer(old),outer(other),row(first),row(second),flags(rg.b),flags(flags),flags(altFlags));
        StringJoiner prefix=new StringJoiner(",");
        for(int i=0;i<Math.min(4,decoded.size());i++)prefix.add(widget(decoded.get(i)));
        return state+";"+prefix;
    }
    public static void main(String[] args)throws Exception {
        if(args.length==1) {
            String[][] ms={{"wf","a","(Lal;Lal;ZLal;Lal;)V"},{"ki","f","(I)V"},{"qg","a","(IZ)Z"},{"wb","a","(Laj;B)Laj;"},
                {"ad","a","(BI)Laj;"},{"pj","a","(III)Laj;"},{"ra","a","(II)V"}};
            for(String[] m:ms) instrument(Path.of(args[0]),m[0],m[1],m[2]);
            return;
        }
        byte[] bytes=Files.readAllBytes(Path.of(args[0]));
        realIndex=new db(bytes,q.a(0,bytes,bytes.length)); realGroup=Files.readAllBytes(Path.of(args[1]));
        var reader=new BufferedReader(new InputStreamReader(System.in)); var out=new PrintWriter(System.out);
        for(String s;(s=reader.readLine())!=null;)out.println(run(s.split(" ")));
        out.flush();
    }
}
