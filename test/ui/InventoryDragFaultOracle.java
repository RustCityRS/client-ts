import java.io.*;
import java.util.*;
import java.lang.invoke.MethodHandle;

final class InventoryDragFaultOracle {
    public static void main(String[] args) throws Throwable {
        MethodHandle tick=MiniMenuOracle.inventoryTick();
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        aj c=new aj();c.Kc=0x183456;c.R=17;c.vb=0;
        vk.db=17;vb.o=0;pk.k=0;
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int from=v[0],to=v[1],mode=v[2],damage=v[3],size=v[4];
            c.Zb=damage==1?null:damage==2?new int[0]:damage==3?new int[]{12,15}:new int[]{12,15,mode==4?0:18,21};
            c.Ob=damage==4?null:damage==5?new int[0]:damage==6?new int[]{49,73}:new int[]{49,73,84,109};
            c.Sc=damage==7?null:new l(1<<28|(mode==2?1<<29:0),-1);
            c.vb=damage==8?-1:0;c.wc=mode==3?205:206;ff.q=mode==0?0:1;
            ec.e=damage==9?null:c;hg.f=damage==10?null:c;vj.u=from;oj.i=to;u.q=23;
            gl.y=10;bd.S=10;sj.C=10;pf.Q=damage==11?15:16;
            ca.a=damage==12?1:0;oi.h=0;ej.b=damage==13?3:damage==14?Integer.MAX_VALUE:4;te.c=false;
            sf.m[0]=false;
            qk.v.fb=new byte[size];Arrays.fill(qk.v.fb,(byte)0xb7);qk.v.yb=0;qk.v.a(new int[]{39,8,11,31},-1);
            String fault="ok";
            try{tick.invokeExact();}catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
                fault=cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":cause.getClass().getSimpleName();
            }
            String bytes=HexFormat.of().formatHex(qk.v.fb);int pos=qk.v.yb;
            qk.v.fb=new byte[1];qk.v.yb=0;qk.v.k(2,251);
            System.out.println(fault+" "+pos+" "+bytes+" "+(qk.v.fb[0]&255)+" "+Arrays.toString(c.Zb)+" "+Arrays.toString(c.Ob)+" "+(ec.e==c)+" "+ej.b+" "+te.c+" "+u.q+" "+sf.m[0]);
        }
    }
}
