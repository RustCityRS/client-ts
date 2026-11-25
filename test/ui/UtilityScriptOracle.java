import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

class UtilityScriptOracle {
    static final HexFormat hex=HexFormat.of();
    static final int intMark=0x45e24;
    static int nextScript=39501;
    static id text(String token){
        if(token.equals("-"))return null;
        byte[] bytes=hex.parseHex(token);id value=new id();value.A=bytes;value.c=bytes.length;return value;
    }
    static String bytes(id value){return value==null?"-":hex.formatHex(value.A,0,value.c);}
    static class Source extends ud {
        db index;StringJoiner requests=new StringJoiner(",");
        Source(String name)throws Exception{
            byte[] b=Files.readAllBytes(Path.of(name));index=new db(b,q.a(0,b,b.length));
        }
        db b(int dummy){return index;}
        byte[] a(int dummy,int group){requests.add(""+group);return null;}
        void b(int dummy,int group){} int c(int dummy,int group){return 0;}
    }
    static void run(int op,int[] ints,id[] strings){
        m code=new m();int n=6+ints.length+strings.length,pos=0;
        code.D=new int[n];code.F=new int[n];code.B=new id[n];
        code.D[pos]=0;code.F[pos++]=7124;
        code.D[pos]=3;code.B[pos++]=aj.a("before",(byte)-100);
        for(int v:ints){code.D[pos]=0;code.F[pos++]=v;}
        for(id v:strings){code.D[pos]=3;code.B[pos++]=v;}
        code.D[pos++]=op;code.D[pos]=0;code.F[pos++]=intMark;
        code.D[pos]=3;code.B[pos++]=aj.a("after",(byte)-100);code.D[pos]=21;
        int script=nextScript++;sf.g.a((long)script,0,code);
        wf event=new wf();event.G=new Object[]{script};gh.a(event,-22368,10000);
    }
    static String result(){
        StringJoiner ints=new StringJoiner(","),strings=new StringJoiner(",");
        for(int i=0;i<20;i++){ints.add(""+tg.B[i]);if(tg.B[i]==intMark)break;}
        for(int i=0;i<20;i++){strings.add(bytes(g.p[i]));if(bytes(g.p[i]).equals("6166746572"))break;}
        return ints+";"+strings;
    }
    public static void main(String[] args)throws Throwable{
        if(args[0].equals("exit")){
            tb.h=(java.awt.Frame)BrowserPacketOracle.allocate(java.awt.Frame.class);
            System.out.println("before exit");run(5411,new int[]{},new id[]{});throw new AssertionError("script continued after exit");
        }
        BrowserPacketOracle.Page page=(BrowserPacketOracle.Page)BrowserPacketOracle.allocate(BrowserPacketOracle.Page.class);
        jg.k=(p)BrowserPacketOracle.allocate(client.class);tj.m=new fb(page,0,null,0);
        Source source=new Source(args[0]);h.i=new al(source,false,true);
        qk.v.a(new int[]{3,7,11,13},-1);
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=reader.readLine())!=null;){
                String[] v=line.split("\\|",-1);int op=Integer.parseInt(v[0]),i=Integer.parseInt(v[1]);
                int[] nums=v[2].isEmpty()?new int[]{}:Arrays.stream(v[2].split(",")).mapToInt(Integer::parseInt).toArray();
                id[] words=v[3].equals("~")?new id[]{}:Arrays.stream(v[3].split(",",-1)).map(UtilityScriptOracle::text).toArray(id[]::new);
                d.c=i%3;hl.w=i%4;ce.F=i*9981171;oj.k=i%3==1?null:aj.a(i%3==2?"é+?x":"",(byte)-100);
                fb.f=i%2+2;fb.l=i%4<2?"windows":"linux";vk.kb=i%5==0;
                dd.e=null;if(i%4!=0){dd.e=new dj();dd.e.c=i*51937153;if(i%4>=2)dd.e.a=i%4==2?"höst.name":"a\0😀b";}
                rc.h=de.v=la.Z=al.q=new short[256];Arrays.fill(sf.m,false);
                for(ve cache:new ve[]{ra.M,gb.r,uk.k,pb.xc})cache.a(1L,"hit",(byte)-71);
                dd.i=o.R=sc.N=c.E=ra.Q=new rh(1,1);ec.g=i%3==1;
                lj.j=d.p=jh.m=bc.i=bi.k=ah.e=fd.ab=nh.O=bd.W=qi.U=bj.h=181;
                gl.C=92;me.P=93;b.L=null;client.sb=null;pa.tb=false;BrowserPacketOracle.shown="~";
                hc.a=(i&1)!=0;ob.q[81]=(i&1)!=0;ob.q[82]=(i&2)!=0;ob.q[86]=(i&4)!=0;
                qk.v.yb=0;source.requests=new StringJoiner(",");
                ByteArrayOutputStream log=new ByteArrayOutputStream();PrintStream original=System.out;
                fb savedLink=tj.m;int writes=b.N;
                try(PrintStream capture=new PrintStream(log,true,StandardCharsets.UTF_8)){
                    if(op==6600)tj.m=null;
                    System.setOut(capture);run(op,nums,words);
                }finally{System.setOut(original);tj.m=savedLink;}
                if(b.L!=null)for(int tick=0;b.L.b==0&&tick<1000;tick++)Thread.sleep(1);
                StringBuilder caches=new StringBuilder();for(ve c:new ve[]{ra.M,gb.r,uk.k,pb.xc})caches.append(c.a(1L,false)==null?'0':'1');
                int dirty=0;for(boolean b:sf.m)if(b)dirty++;
                String req=b.L==null?"-":b.L.e+","+b.L.b+","+hex.formatHex(((String)b.L.d).getBytes(StandardCharsets.UTF_8));
                System.out.println(result()+";"+hex.formatHex(qk.v.fb,0,qk.v.yb)+";"+Arrays.hashCode(rc.h)+","+dirty+","+caches+
                    ";"+hex.formatHex(BrowserPacketOracle.shown.getBytes(StandardCharsets.UTF_8))+","+bytes(client.sb)+","+pa.tb+","+req+
                    ";"+lj.j+","+d.p+","+jh.m+","+bc.i+","+bi.k+","+ah.e+","+fd.ab+","+nh.O+","+bd.W+","+qi.U+","+bj.h+","+ec.g+
                    ","+(dd.i!=null)+","+(o.R!=null)+","+(sc.N!=null)+","+(c.E!=null)+","+(ra.Q!=null)+","+gl.C+","+me.P+
                    ";"+source.requests+";"+hex.formatHex(log.toString(StandardCharsets.UTF_8).replace("\r\n","\n").getBytes(StandardCharsets.UTF_8))+";"+hc.a+","+(b.N-writes));
            }
        }finally{tj.m.a(100);}
    }
}
