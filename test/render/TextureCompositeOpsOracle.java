import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public final class TextureCompositeOpsOracle {
    static final int[] edge={Integer.MIN_VALUE,Integer.MAX_VALUE,-1,0,1,2047,2048,4095,4096,4097,-56789,123456,0x60000317};
    static final int width=edge.length;
    static StringJoiner calls;
    static final class Input extends bf {
        final int index;
        int[] mono=new int[width];
        int[][] rgb={new int[width],new int[width],new int[width]};
        Input(int index,boolean flag,int seed) {
            super(0,flag);this.index=index;
            for(int x=0;x<width;x++){
                mono[x]=edge[(x+seed*(index+1)+index*3)%width];
                for(int c=0;c<3;c++)rgb[c][x]=edge[(x+seed*(index+1)+index*3+(x%3==0?0:c*2))%width];
            }
        }
        int[] a(int row,byte dummy) { calls.add(index+"m"+row);return mono; }
        int[][] a(boolean dummy,int row) { calls.add(index+"c"+row);return rgb; }
    }
    static final class Case {
        final String name;
        final bf op;
        final Input[] inputs=new Input[3];
        final List<int[]> retained=new ArrayList<>();
        int[] outM; int[][] outC;
        gd packet;
        static Field field(Class<?> c,String n) throws Exception {var f=c.getDeclaredField(n);f.setAccessible(true);return f;}
        Case(String[] v)throws Exception {
            name=v[0];op=switch(name){case "o"->new o();case "qa"->new qa();case "ge"->new ge();case "uh"->new uh();case "ic"->new ic();default->new s();};
            calls=new StringJoiner(","); hf.I=width;
            int mode=Integer.parseInt(v[1]), rgb=Integer.parseInt(v[2]), mask=Integer.parseInt(v[3]), seed=Integer.parseInt(v[4]);
            if(mode!=-1) {
                if(name.equals("o"))decode(0,mode);
                if(name.equals("uh")||name.equals("ge")){decode(0,mode*67,mode*53+1);decode(1,mode*19+3,mode*7-1);}
                if(name.equals("s"))for(int i=0;i<3;i++)decode(i,mode*53+1+i*3,mode*3+48+i);
            }
            if(rgb!=-1){
                int code=switch(name){case "o"->1;case "qa"->0;case "ge"->2;default->-1;};
                if(code!=-1)decode(code,rgb==0?1:0);
            }
            for(int i=0;i<inputs.length;i++){
                inputs[i]=new Input(i,(mask&(1<<i))!=0,seed);
                retained.add(inputs[i].mono);retained.addAll(Arrays.asList(inputs[i].rgb));
                if(i<op.z.length)op.z[i]=inputs[i];
            }
            String fault=v[5];
            if(fault.equals("real")) {
                vg.U=inputs[0].mono;cf.h=inputs[1].mono;
                for(int i=0;i<op.z.length;i++) {
                    bf src=switch((i+seed)%4){case 0->new sc();case 1->new dk();case 2->new ri();default->new gf();};
                    src.K=1;src.a((byte)-120,width,2);op.z[i]=src;
                }
            }
            op.K=1;op.a((byte)-120,width,2);
            if(op.L){outM=((int[][])field(wk.class,"v").get(op.I))[0];Arrays.fill(outM,-76);retained.add(outM);}
            else {outC=((int[][][])field(pi.class,"a").get(op.C))[0];for(int c=0;c<3;c++){Arrays.fill(outC[c],-76-c);retained.add(outC[c]);}}
            if(fault.equals("alias")&&!op.L){outC[0]=inputs[0].rgb[1];outC[1]=inputs[1].rgb[2];outC[2]=inputs[0].rgb[0];}
            if(fault.equals("alias")&&op.L){outM=inputs[1].mono;((int[][])field(wk.class,"v").get(op.I))[0]=outM;}
            if(fault.equals("badDst")&&op.L){outM=new int[1];((int[][])field(wk.class,"v").get(op.I))[0]=outM;retained.add(outM);}
            if(fault.equals("badDst")&&!op.L){outC[1]=new int[1];retained.add(outC[1]);}
            if(fault.equals("shortDst")&&!op.L){outC=new int[1][];((int[][][])field(pi.class,"a").get(op.C))[0]=outC;}
            if(fault.equals("noChild"))op.z[0]=null;
            if(fault.equals("shortChild"))op.z=new bf[0];
            if(fault.equals("noArray"))op.z=null;
            if(fault.equals("zeroWidth"))hf.I=0;
            if(fault.equals("negWidth"))hf.I=-1;
            if(fault.equals("badWidth"))hf.I=width+1;
            if(fault.startsWith("src")){
                int idx=fault.charAt(3)-'0', ch=fault.charAt(4)-'0';int[] edit=fault.charAt(5)=='n'?null:new int[1];
                if(edit!=null)retained.add(edit);
                if(ch==3)inputs[idx].rgb=null;
                else if(ch==4)inputs[idx].rgb=new int[1][];
                else{inputs[idx].mono=edit;inputs[idx].rgb[ch]=edit;}
            }
            if(fault.equals("dual")){
                inputs[0].mono=null;inputs[1].mono=new int[0];
                inputs[0].rgb[0]=null;inputs[1].rgb[0]=new int[0];
            }
            if(fault.equals("allZero"))Arrays.fill(inputs[2].mono,0);
            if(fault.equals("allOne"))Arrays.fill(inputs[2].mono,4096);
        }
        void decode(int code,int... bytes){
            byte[] data=new byte[bytes.length];for(int i=0;i<data.length;i++)data[i]=(byte)bytes[i];
            op.a(new gd(data),true,code);
        }
        String fields()throws Exception {
            String names=switch(name){case "o"->"ab";case "ge"->"N T W";case "uh"->"bb T";case "s"->"T R V";default->"";};
            StringJoiner s=new StringJoiner(",");s.add(op.L?"1":"0");
            if(!names.isEmpty())for(String n:names.split(" "))s.add(""+field(op.getClass(),n).getInt(op));
            return s.toString();
        }
        String trace(String command)throws Exception {
            String status="ok";
            try {
                if(command.startsWith("d")) {
                    String[] c=command.substring(1).split(":");int code=Integer.parseInt(c[0]);
                    packet=c[1].equals("no")?null:new gd(c[1].equals("null")?null:c[1].equals("-")?new byte[0]:HexFormat.of().parseHex(c[1]));
                    if(packet!=null)packet.yb=Integer.parseInt(c[2]);op.a(packet,true,code);
                } else if(command.equals("p"))op.b(105);
                else if(command.equals("w")){
                    if(op.L&&outM!=null&&outM.length>0)outM[0]=123;
                    if(!op.L&&outC!=null&&outC.length>0&&outC[0]!=null)outC[0][0]=123;
                } else if(command.startsWith("g")){
                    int row=Integer.parseInt(command.substring(1));
                    Object result=op.L?op.a(row,(byte)55):op.a(true,row);
                    status=result==null?"nil":result==(op.L?(Object)outM:outC)?"same":"other";
                }
            } catch(RuntimeException e){
                Throwable t=e;while(t instanceof g && ((g)t).a!=null)t=((g)t).a;
                status=t instanceof NullPointerException?"null":t instanceof IndexOutOfBoundsException?"bounds":t instanceof IllegalStateException?"state":t.getClass().getSimpleName();
            }
            int hash=1;for(int[] pixels:retained)hash=31*hash+Arrays.hashCode(pixels);
            return status+":"+fields()+":"+(packet==null?"-":packet.yb)+":"+(op.I==null?"-":op.I.w?"1":"0")+":"+(op.C==null?"-":op.C.w?"1":"0")+":"+hash;
        }
    }
    public static void main(String[] args)throws Exception{
        var input=new BufferedReader(new InputStreamReader(System.in));var out=new PrintWriter(System.out);
        for(String line;(line=input.readLine())!=null;){String[] v=line.split(" ");Case row=new Case(v);var r=new StringJoiner("|");
            for(String command:v[6].split(","))r.add(row.trace(command));out.println(r+";"+calls);}
        out.flush();
    }
}
