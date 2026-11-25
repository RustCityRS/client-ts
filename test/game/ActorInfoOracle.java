import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Executes the original sc.e / da.b readers, pb appearance and gk/ud ticks in the SD gamepack.
final class ActorInfoOracle {
    static final HexFormat hex=HexFormat.of();
    static final int[] slots={2047,9,15,73};
    static Field field(Class<?> owner,String name)throws Exception{
        Field f=owner.getDeclaredField(name);f.setAccessible(true);return f;
    }
    static String value(Object o)throws Exception {
        if(o==null)return "~";
        if(o instanceof int[] v)return Arrays.toString(v);
        if(o instanceof byte[] v)return hex.formatHex(v);
        if(o instanceof id v)return hex.formatHex(v.A,0,v.c);
        if(o instanceof ja t)return "#"+t.G;
        if(o instanceof gd p)return p.yb+"#"+hex.formatHex(p.fb);
        if(o instanceof cl t)return fields(cl.class,t);
        if(o instanceof ci t)return fields(ci.class,t);
        if(o instanceof Object[] v){
            StringJoiner j=new StringJoiner(",","[","]");
            for(Object x:v)j.add(value(x));
            return j.toString();
        }
        return String.valueOf(o);
    }
    static String fields(Class<?> c,Object v)throws Exception{
        StringJoiner j=new StringJoiner(",");
        Field[] fields=c.getDeclaredFields();
        Arrays.sort(fields,Comparator.comparing(Field::getName));
        for(Field f:fields)if(!Modifier.isStatic(f.getModifiers())){
            f.setAccessible(true);j.add(f.getName()+"="+value(f.get(v)));
        }
        return j.toString();
    }
    static String actor(ob a)throws Exception {
        if(a==null)return "~";
        return fields(ob.class,a)+"#"+fields(a.getClass(),a);
    }
    static void reset(int variant){
        oh.a(true,24077);
        Arrays.fill(tf.J,null);Arrays.fill(uc.l,null);Arrays.fill(d.d,null);
        Arrays.fill(ad.h,0);Arrays.fill(fi.n,0);Arrays.fill(ii.j,0);Arrays.fill(bd.O,0);
        tf.J[2047]=te.g=new pb();jl.c=variant;ah.f=0;hk.e=vj.t=0;
        il.L=jh.i=ed.d=fe.R=ag.l=0;
        hd.b=new be(5000);m.C=variant==0?pk.c:gk.b;
        for(int i=0;i<4;i++){
            ja type=new ja();type.G=501+i;type.M=1+i;type.s=i==1?0:64-i;type.q=340;
            if(i==2){type.a=92;type.B=4;}
            gf.Z.a((long)type.G,type,(byte)-71);
            ek seq=new ek();seq.f=101+i;seq.h=3+i;seq.b=i%3;seq.g=new int[]{6,7,8};seq.F=new int[]{0,2,1};
            seq.H=new int[][]{{(123+i)<<8|33},null,{166<<8|97}};seq.G=2;seq.a=3;seq.o=0;seq.k=1;
            ga.B.a((long)seq.f,seq,(byte)-71);
            li spot=new li();spot.k=seq.f;spot.d=211+i;r.V.a((long)spot.d,spot,(byte)-71);
        }
        ig.n.a(340L,new mg(),(byte)-71);
        tk.e=new int[]{15000,15001};
        for(int id:tk.e){kl type=new kl();type.Ab=id-14998;fa.b.a((long)id,type,(byte)-71);}
        dd.u=pd.t=127;
    }
    public static void main(String[] args)throws Exception{
        var in=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=in.readLine())!=null){
            var a=line.split(" ",-1);String result="ok";int pos=-1;
            gd appearance=null;
            try{
                hh.kb=Integer.parseInt(a[1]);
                switch(a[0]){
                    case "start" -> reset(Integer.parseInt(a[2]));
                    case "a" -> {appearance=new gd(hex.parseHex(a[2]));te.g.a(appearance,-100);}
                    case "p","n" -> {
                        hd.b.fb=hex.parseHex(a[2]);hd.b.yb=0;af.I=Integer.parseInt(a[3]);
                        if(a[0].equals("p"))sc.e(-1);else da.b((byte)-70);
                    }
                    case "wirep", "wiren" -> {
                        byte[] bytes=hex.parseHex(a[2]);
                        java.net.Socket sock=new java.net.Socket() {
                            public void setSoTimeout(int t){}
                            public void setTcpNoDelay(boolean b){}
                            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
                            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
                        };
                        ek.s=new se(sock,null);
                        hd.b.fb=new byte[bytes.length];hd.b.yb=4;af.I=Integer.parseInt(a[3]);
                        o.Y=a[0].equals("wirep")?225:32;
                        if(!rg.a((byte)57))throw new AssertionError("unexpected pending packet");
                        result="wire"+o.Y;
                    }
                    case "pm" -> {
                        hd.b.fb=hex.parseHex(a[2]);hd.b.yb=0;
                        il.a(9,null,-100,Integer.parseInt(a[3]));
                    }
                    case "nm" -> {
                        hd.b.fb=hex.parseHex(a[2]);hd.b.yb=0;ii.j[0]=9;il.L=1;
                        wd.a(-124);
                    }
                    case "t" -> {vg.f(10046);kg.b(false);oj.a(false);}
                    default -> throw new AssertionError(line);
                }
            }catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
                result=cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":
                    cause instanceof ArithmeticException?"arithmetic":cause.getMessage();
            }
            if(appearance!=null)pos=appearance.yb;
            StringJoiner row=new StringJoiner("|");
            row.add(result).add(""+pos).add(""+hd.b.yb).add(""+field(be.class,"Db").getInt(hd.b));
            row.add(ah.f+","+fe.R+","+ed.d+","+il.L+","+jh.i);
            for(int[] list:new int[][]{ad.h,fi.n,ii.j,bd.O})row.add(""+Arrays.hashCode(list));
            for(int i:slots){row.add(actor(tf.J[i]));row.add(actor(uc.l[i]));row.add(value(d.d[i]));}
            row.add(Arrays.toString(Arrays.copyOf(ff.J,ag.l)));
            StringJoiner areas=new StringJoiner(",");
            for(ik s=(ik)ik.s.d(0);s!=null;s=(ik)ik.s.a(0))areas.add(s.t+":"+s.B+":"+s.N+":"+s.A);
            for(ik s=(ik)jk.A.c((byte)36);s!=null;s=(ik)jk.A.a(11))areas.add(s.t+":"+s.B+":"+s.N+":"+s.A);
            row.add(areas.toString());
            System.out.println(row);
        }
    }
}
