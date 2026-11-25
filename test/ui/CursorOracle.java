import java.awt.Point;
import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.*;

class CursorOracle {
    static Field field(Class<?> c,String n)throws Exception{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}
    static String state()throws Exception{
        dj request=(dj)field(fb.class,"j").get(tj.m);
        if(request==null)return qh.c+":-";
        Object[] args=(Object[])request.d;
        Point point=(Point)args[2];
        field(fb.class,"c").set(tj.m,null);field(fb.class,"j").set(tj.m,null);
        return qh.c+":"+request.e+":"+request.c+":"+((args[0]==pe.S)?1:0)+":"+point.x+":"+point.y+":"+Arrays.hashCode((int[])args[1]);
    }
    public static void main(String[] args)throws Exception {
        al config=new al(new FloorConfigOracle.Provider(Path.of(args[0])),false,true);
        al sprites=new al(new FloorConfigOracle.Provider(Path.of(args[1])),false,true);
        bh.a(-33,config,sprites);
        tj.m=new fb(null,32,null,28);tj.m.a(15);wb.db=true;
        int count=config.c(33,64);
        System.out.println(count);
        for(int i=-1;i<=count;i++){
            dl type=il.a(true,i);rh sprite=type.a(-6864);
            System.out.println(i+":"+field(dl.class,"a").getInt(type)+":"+type.o+":"+type.d+":"+(type==il.a(true,i))+":"+
                (sprite==null?"-":sprite.O+":"+sprite.D+":"+Arrays.hashCode(sprite.a())+":"+(sprite==type.a(-6864))));
            sc.a(i,true);System.out.println(state());sc.a(i,true);System.out.println(state());
            wb.db=false;sc.a(i,true);System.out.println(state());wb.db=true;
        }
        for(int sprite:new int[]{0,641,642,802,65535,0}){
            dl type=new dl();
            type.a(2,500,new gd(new byte[]{1,(byte)(sprite>>8),(byte)sprite,2,9,13,0}));
            int id=1000+sprite;
            r.X.a((long)id,type,(byte)-71);
            rh loaded=type.a(-6864);
            System.out.println(loaded==null?"missing":loaded.getClass().getName()+":"+Arrays.hashCode(loaded.I));
            sc.a(id,true);System.out.println(state());
            sc.a(id,true);System.out.println(state());
            vi.c(0,4);ig.c(-1);
        }
        ChatOracle.run(new String[]{"script","5426","217","",""});
        System.out.println("default:"+ig.t);
        for (boolean spriteCache : new boolean[]{false,true}) {
            Object unexpected = new Object();
            ve cache = spriteCache ? ii.i : r.X;
            long key = spriteCache ? 0 : -123;
            cache.a(key,unexpected,(byte)-71);
            String status = "returned";
            try {
                if (spriteCache) new dl().a(-6864);
                else il.a(true,-123);
            } catch (g ex) {
                if (!(ex.a instanceof ClassCastException)) throw ex;
                status = "cast";
            }
            System.out.println(status+":"+(cache.a(key,false)==unexpected));
        }
        for (String line; (line=in.readLine())!=null;){
            gd p=new gd(HexFormat.of().parseHex(line));dl type=new dl();String result="ok";
            try{type.a(2,91,p);}catch(RuntimeException error){result="error";}
            System.out.println(result+":"+p.yb+":"+field(dl.class,"a").getInt(type)+":"+type.o+":"+type.d);
        }
    }
    static final BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
}
