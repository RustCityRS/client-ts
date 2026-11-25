import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.*;

public final class TextureLightingOpsOracle {
    static final byte[] originalTable = je.Q;
    static final int[] edges = {Integer.MIN_VALUE, -1, 0, 1, 408, 409, 410, 1365, 2048, 4095, 4096, 65535, Integer.MAX_VALUE};
    static final int[][] colours = {
        {2048,2048,2048}, {4096,0,0}, {0,4096,0}, {0,0,4096}, {4096,4096,0}, {0,4096,4096}, {4096,0,4096},
        {3333,2000,1000}, {3333,1000,2000}, {1000,3333,2000}, {2000,3333,1000}, {1000,2000,3333}, {2000,1000,3333}
    };
    static final String[][] fields = {{"P","R","T","V","W"},{"P","Q","U","X","Y","Z","ab","bb","db"},
        {"P","W","X","Z"},{"P","R","Z","ab","bb","cb","eb"},{"Q"}};
    static Field field(Object owner,String name) throws Exception {
        Field f=owner.getClass().getDeclaredField(name); f.setAccessible(true); return f;
    }
    static final class Child extends bf {
        final int width, mode;
        final StringBuilder calls=new StringBuilder();
        final int[][] shared;
        Child(int width,int mode,boolean mono){super(0,mono);this.width=width;this.mode=mode;shared=new int[3][width];}
        int[] channel(int row,int c){
            int[] a=mode==3?shared[c]:new int[width];
            for(int x=0;x<a.length;x++){
                int i=Math.floorMod(x+row,edges.length);
                a[x]=switch(mode){
                    case 1 -> edges[(i+c*3)%edges.length];
                    case 2 -> colours[i][c];
                    case 4 -> (x+c+row)%3==0?409:410;
                    default -> (x*x*337+391*row+1147*c+x*row)&8191;
                };
            }
            if(mode==5&&c==0)return Arrays.copyOf(a,Math.min(2,width));
            if(mode==6&&c==1)return null;
            if(mode==7&&c==2)return Arrays.copyOf(a,Math.min(2,width));
            return a;
        }
        @Override int[] a(int row,byte dummy){calls.append('m').append(row).append(',');return channel(row,0);}
        @Override int[][] a(boolean dummy,int row){
            calls.append('c').append(row).append(',');
            if(mode==8)return null;
            if(mode==9)return new int[1][];
            return new int[][]{channel(row,0),channel(row,1),channel(row,2)};
        }
    }
    static final class Case {
        final bf op;
        final int kind,width,height;
        final Child child;
        final IdentityHashMap<Object,Integer> ids=new IdentityHashMap<>();
        Object last;
        gd packet;
        Case(String[] p){
            kind=Integer.parseInt(p[0]);width=Integer.parseInt(p[1]);height=Integer.parseInt(p[2]);
            op=switch(kind){case 0->new va();case 1->new qe();case 2->new ab();case 3->new ib();case 4->new r();default->throw new AssertionError();};
            int mode=Integer.parseInt(p[4]);
            child=new Child(width,mode,p[5].equals("1")); if(op.z.length>0)op.z[0]=child;
            hf.I=g.k=-1;h.e=null;c.t=null;je.Q=originalTable;vk.a(119,width,height);
            if(mode==1){
                for(int x=0;x<width;x++)vg.U[x]=edges[x%edges.length];
                for(int y=0;y<height;y++)cf.h[y]=edges[(5*y)%edges.length];
            }
            op.K=Integer.parseInt(p[3]);
            op.a((byte)-120,width,height);
        }
        String pixels(Object v){
            if(v==null)return "_";
            int id=ids.computeIfAbsent(v,k->ids.size()+1);
            if(v instanceof int[] a)return id+Arrays.toString(a).replace(" ","");
            StringJoiner s=new StringJoiner(",",id+"[","]");for(Object a:(Object[])v)s.add(pixels(a));return s.toString();
        }
        Object[] slots() throws Exception{
            return op.L ? (Object[])field(op.I,"v").get(op.I) : (Object[])field(op.C,"a").get(op.C);
        }
        String state()throws Exception {
            StringJoiner s=new StringJoiner("|"); s.add(packet==null?"-":""+packet.yb);
            for(String f:fields[kind]){Object v=field(op,f).get(op);s.add(v instanceof Integer?v.toString():pixels(v));}
            s.add(child.calls.toString()).add(pixels(last)).add(""+(op.L?op.I.w:op.C.w));
            for(Object slot:slots())s.add(pixels(slot));
            return s.toString();
        }
        String run(String cmd)throws Exception{
            String result="ok";
            try{
                switch(cmd.charAt(0)){
                    case 'd' -> {
                        String[] v=cmd.substring(1).split(":");
                        packet=v[1].equals("none")?null:new gd(v[1].equals("null")?null:v[1].equals("-")?new byte[0]:HexFormat.of().parseHex(v[1]));
                        op.a(packet,true,Integer.parseInt(v[0]));
                    }
                    case 'p' -> op.b(60);
                    case 'g' -> {int row=Integer.parseInt(cmd.substring(1));last=op.L?op.a(row,(byte)55):op.a(true,row);}
                    case 'a' -> {Field f=field(op,"P");f.set(op,cmd.length()==1?null:new int[]{7});}
                    case 'b' -> {Object[] a=slots();if(op.L)a[0]=new int[]{77};else ((int[][])a[0])[1]=new int[]{77};}
                    case 'l' -> je.Q=cmd.length()==1?null:new byte[]{-67};
                    case 'c' -> c.t=cmd.length()==1?null:new int[]{-69};
                    case 'x' -> vg.U=cmd.length()==1?null:new int[]{2048};
                    case 'y' -> cf.h=cmd.length()==1?null:new int[]{2048};
                    case 'w' -> hf.I=Integer.parseInt(cmd.substring(1));
                    case 'm' -> kl.Eb=Integer.parseInt(cmd.substring(1));
                    case 'v' -> vi.hb=Integer.parseInt(cmd.substring(1));
                    case 's' -> j.b=Integer.parseInt(cmd.substring(1));
                    case 't' -> result=""+Arrays.hashCode(je.Q);
                    default -> throw new AssertionError(cmd);
                }
            }catch(RuntimeException e){
                Throwable t=e;while(t instanceof g wrapper)t=wrapper.a;
                if(t instanceof NullPointerException)result="null";
                else if(t instanceof ArithmeticException)result="arith";
                else if(t instanceof IndexOutOfBoundsException)result="bounds"+t.getMessage().split(" ")[1];
                else throw e;
            }
            return result+":"+state();
        }
    }
    public static void main(String[] args)throws Exception{
        BufferedReader r=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=r.readLine())!=null;){
            String[] p=line.split(" "); Case c=new Case(p);StringJoiner result=new StringJoiner(";");
            result.add(c.state());for(int i=6;i<p.length;i++)result.add(c.run(p[i]));
            System.out.println(result);
        }
    }
}
