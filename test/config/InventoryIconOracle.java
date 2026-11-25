import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.Path;
import java.util.*;

class InventoryIconOracle {
    static al objects, models;
    static fg font;
    static kg textures;
    static Field modelId;
    static pc noTexels;
    static int[] cosine, sine;
    static final IdentityHashMap<Object,Integer> ids = new IdentityHashMap<>();
    static int tag(Object obj) { return obj == null ? 0 : ids.computeIfAbsent(obj,k->ids.size()+1); }
    static String pixels(int[] p) {
        if (p == null) return "-";
        ByteBuffer bytes = ByteBuffer.allocate(p.length*4).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asIntBuffer().put(p);
        return Base64.getEncoder().encodeToString(bytes.array());
    }
    static String run(int[] v) throws Exception {
        int id=v[0], count=v[1], outline=v[2], shadow=v[3], mode=v[6];
        boolean show=v[4]!=0, enlarged=v[5]==2;
        if (v[7]!=0) gb.r=new ve(100);
        int packed=id+(show?65536:0)+(outline<<17)+(shadow<<19);
        long key=3849834839L*packed+3147483667L*count;
        fa.b=new ve(64); wd.i=objects; nf.c=models; ae.k=font;
        dc.r=mode==12?noTexels:textures; dc.g=cosine; dc.l=sine;
        int[] prev=new int[53*43]; Arrays.fill(prev,0x32577a);
        td.a(prev,53,43); td.b(3,7,48,40); dc.d(); dc.c(23,28);
        td.f=new int[33]; td.a=new int[33]; dc.a=(mode&1)==0;dc.h=true;dc.e=74;dc.j=true;
        if (mode==1) nf.c=null;
        else if (mode==3) ae.k=null;
        else if (mode==4) dc.g=null;
        else if (mode==5) dc.l=null;
        else if (mode==10) gb.r.a(key,new Object(),(byte)-71);
        else if (mode==11) gb.r.a(key,new rh(3,2),(byte)-71);
        else if (mode==13) wd.i=null;
        // Restore the previous clip, then fail while rebuilding its 3D
        // scanline table (the next power of two overflows to a negative int).
        else if (mode==19) td.d=0x40000100;
        else if (mode==20) td.g=null;
        else if (mode!=0 && mode!=12) {
            kl t=rg.a(id,-28322);
            switch(mode) {
                case 2: modelId.setInt(t,-1); break;
                case 6: t.U=2048; break;
                case 7: t.V=new int[]{1}; t.y=new int[]{2}; break;
                case 8: modelId.setInt(rg.a(t.l,-28322),-1); break;
                case 9: modelId.setInt(rg.a(t.O,-28322),-1); break;
                case 14: t.gb=Integer.MAX_VALUE; break;
                case 15: t.gb=Integer.MIN_VALUE; break;
                case 16: t.y=null;t.V=new int[10];break;
                case 17: t.m=Integer.MIN_VALUE;break;
                case 18: t.v=1;t.J=2;t.l=4151;t.O=300;break;
            }
        }
        String error="ok";rh sprite=null;
        try {
            sprite=(rh)(v[5]==0?jg.a(id,outline,show,count,(byte)-65,shadow):jb.a(id,false,count,enlarged,120,outline,show,shadow));
        } catch(RuntimeException e) {
            Throwable cause=e;while(cause instanceof g wrap)cause=wrap.a;
            error=cause instanceof NullPointerException?"null":cause instanceof ClassCastException?"cast":
                cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NegativeArraySizeException?"size":cause.getClass().getSimpleName();
        }
        Object cached=gb.r.a(key,false);
        return String.join("|",error,""+key,""+tag(sprite),cached instanceof rh?""+tag(cached):cached==null?"0":"other",
            ""+gb.r.b((byte)-14),""+dc.h,td.g==prev?"old":"icon",
            td.c+","+td.i+","+td.e+","+td.b+","+td.h+","+td.d+","+(td.f==null)+","+(td.a==null),
            dc.a+","+dc.f+","+dc.b+","+dc.p+","+dc.e+","+dc.j,
            sprite==null?"-":sprite.B+","+sprite.A+","+sprite.O+","+sprite.D+","+sprite.F+","+sprite.C,
            sprite==null?"-":pixels(sprite.I),td.g==prev?""+Arrays.hashCode(prev):pixels(td.g));
    }

    public static void main(String[] args) throws Exception {
        Path dir=Path.of(args[0]);
        modelId=kl.class.getDeclaredField("xb"); modelId.setAccessible(true);
        try(var obj=new ProceduralTextureCacheOracle.Disk(dir,19);var mdl=new ProceduralTextureCacheOracle.Disk(dir,7);
            var spr=new ProceduralTextureCacheOracle.Disk(dir,8);var met=new ProceduralTextureCacheOracle.Disk(dir,13);
            var tex=new ProceduralTextureCacheOracle.Disk(dir,9);var mat=new ProceduralTextureCacheOracle.Disk(dir,26)) {
            objects=new al(obj,true,true);models=new al(mdl,true,true);al sprites=new al(spr,true,true);
            font=(fg)sb.a(sprites,sprites.a((byte)95,vb.a("p11_full",(byte)99)),0,0,new al(met,true,true));
            if(font==null)throw new AssertionError("missing p11_full");
            bj.a(objects,-113,true,font,models);
            textures=new kg(new al(tex,false,true),new al(mat,true,true),sprites,20,false);
            noTexels=(pc)Proxy.newProxyInstance(pc.class.getClassLoader(),new Class<?>[]{pc.class},
                (p,m,a)->m.getParameterCount()==3 && m.getParameterTypes()[1]==float.class?null:m.invoke(textures,a));
            java.lang.reflect.Field random=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
            random.setAccessible(true);((Random)random.get(null)).setSeed(1201);dc.a(.7f);
            cosine=dc.g;sine=dc.l;
            BufferedReader input=new BufferedReader(new InputStreamReader(System.in));PrintWriter out=new PrintWriter(System.out);
            for(String row:input.lines().toList())out.println(run(Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray()));
            out.flush();
        }
    }
}
