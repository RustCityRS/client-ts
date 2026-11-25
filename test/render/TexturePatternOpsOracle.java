import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

public class TexturePatternOpsOracle {
    static final int[] boundary={Integer.MIN_VALUE,-8193,-1,0,1,584,585,586,1463,2047,2048,2049,2633,3511,4095,4096,65535,Integer.MAX_VALUE};
    static final String[][] fields={{"T","V","Q","X"},{"cb","Q","T"},{"N","R","Q"},{"W"},{},{"X","gb","P","bb","W"}};
    static Field field(Class<?> cls,String name)throws Exception {
        Field f=cls.getDeclaredField(name);f.setAccessible(true);return f;
    }
    static class Case {
        final int kind,width,height;
        final bf op;
        final IdentityHashMap<int[],Integer> ids=new IdentityHashMap<>();
        int[] last;
        gd packet;
        Case(String[] parts)throws Exception {
            kind=Integer.parseInt(parts[0]);width=Integer.parseInt(parts[1]);height=Integer.parseInt(parts[2]);
            op=switch(kind){case 0->new fe();case 1->new nh();case 2->new vi();case 3->new od();case 4->new sk();case 5->new vg();default->throw new AssertionError();};
            op.K=Integer.parseInt(parts[3]);
            hf.I=g.k=-1;h.e=null;c.t=null;vk.a(119,width,height);
            if(parts[4].equals("b")){
                for(int x=0;x<width;x++)vg.U[x]=boundary[x%boundary.length];
                for(int y=0;y<height;y++)cf.h[y]=boundary[(y*5)%boundary.length];
            }
        }
        String data(int[] a) {
            if(a==null)return "-";
            int id=ids.computeIfAbsent(a,k->ids.size()+1);
            return id+"/"+a.length+"/"+Arrays.hashCode(a);
        }
        String state()throws Exception {
            var out=new StringJoiner(",");
            for(String name:fields[kind]){
                Object f=field(op.getClass(),name).get(op);
                out.add(f instanceof Integer?f.toString():data((int[])f));
            }
            out.add(packet==null?"-":""+packet.yb);
            out.add(data(last));
            if(op.I!=null){
                out.add(op.I.w?"1":"0");
                int[][] pixels=(int[][])field(wk.class,"v").get(op.I);
                if(pixels!=null)for(int[] p:pixels)out.add(data(p));
            }
            return out.toString();
        }
        String run(String cmd)throws Exception {
            String result="ok";
            try {
                switch(cmd.charAt(0)){
                    case 'i'->op.a((byte)-120,width,height);
                    case 'p'->op.b(60);
                    case 'g'->{last=op.a(Integer.parseInt(cmd.substring(1)),(byte)55);result=Arrays.toString(last);}
                    case 'c'->op.d((byte)-100);
                    case 'w'->{if(last!=null&&last.length>0)last[0]=0x452190;}
                    case 'x'->vg.U=cmd.length()==1?null:new int[]{-1,3,41};
                    case 'y'->cf.h=cmd.length()==1?null:new int[]{-1};
                    case 't'->h.e=cmd.length()==1?null:new int[]{-99};
                    case 's'->hf.I=Integer.parseInt(cmd.substring(1));
                    case 'd'->{
                        String[] v=cmd.substring(1).split(":");String hex=v[1];
                        packet=hex.equals("none")?null:new gd(hex.equals("null")?null:hex.equals("-")?new byte[0]:HexFormat.of().parseHex(hex));
                        op.a(packet,true,Integer.parseInt(v[0]));
                    }
                    default->throw new AssertionError(cmd);
                }
            }catch(RuntimeException err){
                Throwable t=err;while(t instanceof g wrapper && wrapper.a!=null)t=wrapper.a;
                result=t instanceof NullPointerException?"null":t instanceof ArithmeticException?"arith":t instanceof IndexOutOfBoundsException?"bounds":t.getClass().getSimpleName();
            }
            return result+":"+state();
        }
    }
    public static void main(String[] args)throws Exception {
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            String[] parts=line.split(" ");var c=new Case(parts);var states=new StringJoiner(";");
            states.add(c.state());
            for(int i=5;i<parts.length;i++)states.add(c.run(parts[i]));
            System.out.println(states);
        }
    }
}
