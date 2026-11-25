import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class ShowObjectOracle {
    static final IdentityHashMap<ug,Integer> objects=new IdentityHashMap<>();
    static final ra[] initial=new ra[4], replacements=new ra[4];
    static final mh[] oldPile=new mh[4];
    static int tileX,tileZ,geometry,readMode,reads;
    static StringBuilder trace;
    static Throwable injected;
    static final IllegalStateException root=new IllegalStateException("observer");
    @SuppressWarnings("unchecked")
    static <E extends Throwable> void raise(Throwable error)throws E{throw (E)error;}

    // In the second pass only, observe the sampled value before advancing the global.
    public static int plane() {
        int before=ah.f;
        trace.append('p').append(before).append(';');
        int read=++reads;
        if (readMode==1 && read==1 || readMode==2 && read==2 || readMode==4 && read==3) ah.f=(before+1)&3;
        if (readMode==3 && read==2) ah.f=-1;
        if (readMode==4+read) throw new IllegalStateException();
        return before;
    }
    static void instrument(Path jar, Path dir) throws Exception {
        try(JarFile file=new JarFile(jar.toFile())){
            ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry("ng.class")));
            ClassWriter out=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions){
                    MethodVisitor base=super.visitMethod(access,name,desc,signature,exceptions);
                    if (!name.equals("b")||!desc.equals("(III)V"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitFieldInsn(int op,String owner,String name,String type){
                            if (op==Opcodes.GETSTATIC&&owner.equals("ah")&&name.equals("f")&&type.equals("I"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ShowObjectOracle","plane","()I",false);
                            else super.visitFieldInsn(op,owner,name,type);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("ng.class"),out.toByteArray());
        }
    }
    static class Observer extends ug {
        final int level,minY;
        Observer(int level,int minY){this.level=level;this.minY=minY;}
        int b(){
            trace.append("m").append(level).append(';');
            if(geometry==17) kl.Bb[level][tileX][tileZ]=replacements[level];
            if(geometry==18) kl.Bb[level][tileX][tileZ]=null;
            if(geometry==19) kl.Bb[level][tileX]=null;
            if(geometry==21) initial[level].H=new ec[1];
            if(geometry==22) initial[level].t=0;
            if(geometry==23) throw new IllegalStateException();
            if(geometry==27){injected=od.a(root,"model");raise(injected);}
            if(geometry==28){injected=new IOException("observer");raise(injected);}
            if(geometry==29){injected=new AssertionError("observer");raise(injected);}
            return minY;
        }
        void a(int a,int b,int c,int d,int e,int f,int g,int h,long key,int i,ue particles){}
        void a(int a,int b,int c,int d,int e){}
    }
    static ug[] models(int level,int minY){
        pb player=new pb();player.Qb=minY;
        bk npc=new bk();npc.Qb=-32768;
        bk high=new bk();high.Qb=127;
        return new ug[]{new Observer(level,-27),npc,high,player};
    }
    static int id(ug o){return o==null?-1:objects.getOrDefault(o,-2);}
    static String stack(int p,mh obj) {
        if(obj==null)return "~";
        return (obj==oldPile[p]?"old":"new")+","+obj.e+","+obj.l+","+obj.a+","+obj.i+","+obj.d+","+id(obj.k)+","+id(obj.b)+","+id(obj.f);
    }
    static String square(int p) {
        ra[][][] squares=kl.Bb;
        if(squares==null||squares.length<=p||squares[p]==null||squares[p].length<=tileX||squares[p][tileX]==null||squares[p][tileX].length<=tileZ)return "!";
        ra tile=squares[p][tileX][tileZ];
        if(tile==null)return "~";
        return (tile==initial[p]?"initial":tile==replacements[p]?"replacement":"new")+","+tile.K+","+tile.N+","+tile.w+","+tile.v+","+tile.t+","+stack(p,tile.y);
    }
    static String order(gk list) {
        if(list==null)return "~";
        StringJoiner result=new StringJoiner(",");
        for(jf node=list.d(0);node!=null;node=list.a(0))result.add(node instanceof b entry?String.valueOf(id(entry.T)):"wrong");
        return result.toString();
    }
    static gk makePile(int kind) {
        if(kind==0)return null;
        gk list=new gk();
        int[] ids=switch(kind){case 1->new int[]{};case 2->new int[]{0};case 4->new int[]{4,4};case 5->new int[]{2,3,1,2};
            case 8->new int[]{0,5,3,1};default->new int[]{1,1,3,0,2,0};};
        ig first=null;
        for(int i=0;i<ids.length;i++){
            ig obj=new ig();obj.m=100+ids[i];obj.p=i==1?Integer.MAX_VALUE:i;
            if(kind==9&&i==1)obj=first;
            if(!objects.containsKey(obj))objects.put(obj,i);
            if(i==0)first=obj;
            list.a(new b(kind==7&&i==3?null:obj),false);
        }
        if(kind==6)list.a(new jf(),false);
        return list;
    }
    static void run(int[] v) {
        int kind=v[0],level=v[2],mask=v[6],minY=v[7];geometry=v[1];readMode=v[3];tileX=v[4];tileZ=v[5];
        objects.clear();trace=new StringBuilder();reads=0;ah.f=level;injected=null;
        int x=tileX,z=tileZ;
        b.H=new gk[4][x+1][];kl.Bb=new ra[4][x+1][];
        boolean large=z>104;
        gk pile=makePile(kind);
        for(int p=0;p<4;p++){
            initial[p]=replacements[p]=null;oldPile[p]=null;
            if(large&&p!=level)continue;
            b.H[p][x]=new gk[z+1];kl.Bb[p][x]=new ra[z+1];
            if(p==level)b.H[p][x][z]=pile;
            ra tile=initial[p]=new ra(p,x,z);
            replacements[p]=new ra(p,x,z);
            mh old=oldPile[p]=new mh();old.e=-912L-p;old.d=97+p;tile.y=old;
            kl.Bb[p][x][z]=tile;
            ug[] models=models(p,minY);
            for(int i=0;i<4;i++){
                ec sprite=tile.H[i]=new ec();
                sprite.u=(i==2?Long.MIN_VALUE:0L)|((mask&(1<<i))!=0?4194304L:32L);
                sprite.z=models[i];
            }
            tile.t=4;
            switch(geometry){
                case 10->kl.Bb[p][x][z]=null;
                case 11->tile.y=null;
                case 12->tile.t=0;
                case 13->tile.H[1]=null;
                case 14,15->tile.H[0].z=null;
                case 16->tile.t=6;
            }
        }
        if(large){ve.q=new int[0][][];tb.t=null;}
        else{
            ve.q=new int[4][x+2][z+2];tb.t=new byte[4][x+1][z+1];
            for(int p=0;p<4;p++)for(int i=0;i<=1;i++)for(int j=0;j<=1;j++)
                ve.q[p][x+i][z+j]=(p-1)*127751+(i==j?5:-39212)+i*170-j*91;
            if(geometry==1||geometry==24)tb.t[1][x][z]=2;
            if(geometry==24)for(int p=0;p<4;p++){ve.q[p][x][z]=Integer.MIN_VALUE;ve.q[p][x+1][z+1]=Integer.MAX_VALUE;}
            if(geometry==2)ve.q=null;
            if(geometry==3||geometry==7)tb.t=null;
            if(geometry==4)ve.q[level]=null;
            if(geometry==5)ve.q[level][x]=null;
            if(geometry==6)ve.q[level][x+1]=new int[z];
            if(geometry==20)tb.t[1][x]=new byte[z];
        }
        if(geometry==8)kl.Bb=null;
        if(geometry==9)kl.Bb[level][x]=null;
        if(geometry==25)b.H=null;
        if(geometry==26)b.H[level][x]=null;
        String fault="ok",context="";
        try{ng.b(v[8],z,x);}
        catch(Throwable error){context=error instanceof g wrapped?wrapped.q:"";Throwable e=error;while(e instanceof g wrapped)e=wrapped.a;
            if(injected!=null && (error!=injected || geometry==27&&e!=root))throw new AssertionError("changed failure identity");
            fault=error==injected?"same":e instanceof NullPointerException?"null":e instanceof IndexOutOfBoundsException?"bounds":
                e instanceof ClassCastException?"cast":e instanceof IllegalStateException?"probe":e.getClass().getSimpleName();}
        StringJoiner state=new StringJoiner("|");
        state.add(fault).add(context).add(trace.toString()).add(""+ah.f).add(order(pile));
        for(int p=0;p<4;p++){state.add(square(p));state.add(initial[p]==null?"!":stack(p,initial[p].y));}
        System.out.println(state);
    }
    static void packet(int opcode,byte[] wire)throws Exception {
        ah.f=1;dg.C=ha.a=0;mi.y=1;kl.Bb=null;ve.q=null;
        b.H=new gk[4][104][104];
        gk list=b.H[1][3][4]=new gk();
        ig existing=new ig();existing.m=100;existing.p=1;list.a(new b(existing),false);
        Socket socket=new Socket(){
            public void setSoTimeout(int timeout){}public void setTcpNoDelay(boolean value){}
            public InputStream getInputStream(){return new ByteArrayInputStream(wire);}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        };
        ek.s=new se(socket,null);hd.b=new be(wire.length);o.Y=opcode;af.I=wire.length;
        try{rg.a((byte)57);throw new AssertionError("expected missing native squares");}
        catch(g error){
            if(!(error.a instanceof NullPointerException))throw error;
            StringJoiner items=new StringJoiner(",");
            for(b item=(b)list.d(0);item!=null;item=(b)list.a(0))items.add(item.T.m+":"+item.T.p);
            System.out.println(error.q+"|"+hd.b.yb+"|"+o.Y+"|"+(list==b.H[1][3][4])+"|"+items);
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length==2){instrument(Path.of(args[0]),Path.of(args[1]));return;}
        int[] costs={73,12,17,13,-99999999,73};
        for(int i=0;i<costs.length;i++){kl type=new kl();type.h=costs[i];type.ib=i==1||i==3?1:0;fa.b.a(100L+i,type,(byte)-71);}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line:in.lines().toList()){
            if(args.length==1){
                String[] row=line.split(" ");
                packet(Integer.parseInt(row[0]),HexFormat.of().parseHex(row[1]));
            }else run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
        }
    }
}
