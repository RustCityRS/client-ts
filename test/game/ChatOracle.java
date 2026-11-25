import java.io.*;
import java.net.Socket;
import java.util.*;
import java.lang.reflect.Field;

class ChatOracle {
    static byte[] bytes(String s){return Base64.getDecoder().decode(s);}
    static String enc(byte[] b){return Base64.getEncoder().encodeToString(b);}
    static String str(id s){return s==null?"-":enc(s.b(false));}
    static id word(String s){byte[] b=bytes(s);return ea.a(b,0,b.length,0);}
    static int num(String s){return Integer.parseInt(s);}
    static int scriptId=70000;
    static class Source extends ud {
        final db index; final byte[][] groups;
        Source(String spec){
            String[] f=spec.split(" ");
            byte[] b=bytes(f[0]);index=new db(b,q.a(0,b,b.length));groups=new byte[index.e][];
            for(int i=1;i<f.length;i++){String[] kv=f[i].split(":",2);groups[num(kv[0])]=bytes(kv[1]);}
        }
        db b(int dummy){return index;}
        byte[] a(int mode,int group){return groups[group];}
        void b(int dummy,int group){}
        int c(int dummy,int group){return 100;}
    }
    static Object read(pe phrase,String name)throws Exception {
        Field f=pe.class.getDeclaredField(name);f.setAccessible(true);return f.get(phrase);
    }
    static String phrase(int id)throws Exception{
        pe phrase=bb.b(id,-32769);
        int[][] params=(int[][])read(phrase,"E");
        gd packet=new gd(256);Arrays.fill(packet.fb,(byte)0xda);
        String result=str(phrase.a(70,packet))+","+packet.yb;
        packet.yb=0;int[] values=new int[phrase.d(92)];Arrays.fill(values,-224);
        phrase.a(-28165,packet,values);
        return id+"|"+phrase.I+"|"+str(phrase.c(false))+"|"+Arrays.toString(phrase.J)+"|"+Arrays.toString((int[])read(phrase,"ab"))+"|"+Arrays.deepToString(params)+"|"+result+"|"+enc(Arrays.copyOf(packet.fb,packet.yb));
    }
    static String category(int id){
        pg c=ib.a((byte)97,id);
        int hash=1;
        for(int k=-1;k<=256;k++){hash=31*hash+c.a(64,k);hash=31*hash+c.b(k,-64);}
        return id+"|"+str(c.U)+"|"+Arrays.toString(c.O)+"|"+Arrays.toString(c.R)+"|"+Arrays.toString(c.I)+"|"+Arrays.toString(c.G)+"|"+hash;
    }
    static String run(String[] parts){ return run(parts,false); }
    static String run(String[] parts,boolean snapshot){
        int op=num(parts[1]);String[] ints=parts[2].isEmpty()?new String[0]:parts[2].split(",");
        String[] strings=parts[3].isEmpty()?new String[0]:parts[3].split(",",-1);
        m code=new m();int len=ints.length+strings.length+2;
        code.D=new int[len];code.F=new int[len];code.B=new id[len];int i=0;
        for(String value:ints){code.D[i]=0;code.F[i++]=num(value);}
        for(String s:strings){code.D[i]=3;code.B[i++]=s.equals("-")?null:word(s.equals("~")?"":s);}
        code.D[i++]=op;code.D[i]=21;
        wf event=new wf();event.G=new Object[]{++scriptId};
        sf.g.a((long)scriptId,0,code);
        if (!snapshot) {
            qk.v.yb=0;gh.a(event,-22368,1000);
            if(parts[4].equals("i"))return ""+tg.B[0];
            if(parts[4].equals("s"))return str(g.p[0]);
            return enc(Arrays.copyOf(qk.v.fb,qk.v.yb));
        }
        Arrays.fill(tg.B,0,8,-11017);
        Arrays.fill(g.p,0,8,null);
        qk.v.yb=0;
        PrintStream stdout=System.out;
        ByteArrayOutputStream diagnostics=new ByteArrayOutputStream();
        try (PrintStream logger=new PrintStream(diagnostics)) {
            System.setOut(logger);
            gh.a(event,-22368,1000);
        } finally { System.setOut(stdout); }
        String report=diagnostics.toString().trim();
        if (!report.isEmpty()) {
            int begin=report.indexOf("CS2 - scr:");
            if(begin<0)throw new AssertionError(report);
            report=report.substring(begin);
        }
        String queued=enc(Arrays.copyOf(qk.v.fb,qk.v.yb));
        String result=parts[4].equals("i")?""+tg.B[0]:parts[4].equals("s")?str(g.p[0]):queued;
        StringJoiner intSlots=new StringJoiner(","),stringSlots=new StringJoiner(",");
        for(int slot=0;slot<8;slot++){intSlots.add(""+tg.B[slot]);stringSlots.add(str(g.p[slot]));}
        return String.join("|",report,result,queued,intSlots.toString(),stringSlots.toString(),
            ""+(bh.h==null?-1:bh.h.g),Arrays.toString(bh.h==null?null:bh.h.k),""+hc.k,""+mc.y,""+Arrays.hashCode(qa.R));
    }
    static void receive(int op,byte[] body)throws Exception{
        Socket socket=new Socket(){
            public void setSoTimeout(int n){} public void setTcpNoDelay(boolean b){}
            public InputStream getInputStream(){return new ByteArrayInputStream(body);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(socket,null);o.Y=op;af.I=body.length;
        if(!rg.a((byte)57))throw new AssertionError();
    }
    static String chatLog(){
        return ve.m+"|"+de.t[0]+"|"+str(ui.q[0])+"|"+str(m.T[0])+"|"+str(ma.j[0])+"|"+jg.z[0];
    }
    static String receiveFault(String[] parts) throws Exception {
        int ringLength=num(parts[3]), duplicate=num(parts[4]), ignoreLength=num(parts[6]);
        rj.t = ringLength < 0 ? null : new long[ringLength];
        if (duplicate >= 0) rj.t[duplicate] = (530L << 32) + 123;
        tj.e = num(parts[5]);
        pi.r = ignoreLength < 0 ? null : new long[ignoreLength];
        n.h = num(parts[7]);
        ve.m = 0;
        sb.c = -9;
        bb.e = 17;
        de.t[0] = -54;
        ui.q[0] = m.T[0] = ma.j[0] = null;
        jg.z[0] = -73;
        String result = "ok";
        try {
            receive(num(parts[1]), bytes(parts[2]));
        } catch (RuntimeException ex) {
            Throwable cause = ex;
            while (cause instanceof g) cause = ((g) cause).a;
            result = cause.getClass().getSimpleName();
            if (ex instanceof g wrapped) result += " " + wrapped.q;
        }
        return String.join("|", result, ""+o.Y, ""+hd.b.yb, ""+tj.e, ""+Arrays.hashCode(rj.t), ""+sb.c, chatLog());
    }
    static int historyHash(id[] slots, id[] labels) {
        if (slots == null) return 0;
        int h = 1;
        for (id item : slots) {
            int i = 0;
            while (i < labels.length && labels[i] != item) i++;
            if (i == labels.length) throw new AssertionError("unexpected history reference");
            h = h * 31 + i;
        }
        return h;
    }
    static void historyWrites() throws Exception {
        String[] keys = {"de.t","m.T","ui.q","ma.j","jg.z"};
        id[] labels = {null, vb.a("a",(byte)100), vb.a("b",(byte)100), vb.a("c",(byte)100)};
        for (int method=0; method<3; method++) for (int field=0; field<5; field++) for (int len : new int[]{-1,0,98,99,100,101}) {
            for (int i=0; i<5; i++) {
                int n = i == field ? len : 100;
                Object value = null;
                if (n >= 0 && (i == 0 || i == 4)) {
                    int[] array = new int[n];
                    for (int j=0;j<n;j++) array[j] = i*109+j;
                    value = array;
                } else if (n >= 0) {
                    id[] array = new id[n];
                    for (int j=0;j<n;j++) array[j] = labels[(i+j)%4];
                    value = array;
                }
                String[] key = keys[i].split("\\.");
                Class.forName(key[0]).getDeclaredField(key[1]).set(null, value);
            }
            ve.m=Integer.MAX_VALUE; sb.c=-3; bb.e=17;
            String outcome="ok";
            try {
                if (method == 0) jd.a(73,labels[1],labels[2],19,-1,labels[3]);
                if (method == 1) mg.a(true,labels[1],labels[3],6);
                if (method == 2) ah.a(labels[3],labels[1],labels[2],false,9);
            } catch (RuntimeException e) { outcome="exception"; }
            System.out.println(String.join("|",outcome,""+ve.m,""+sb.c,""+Arrays.hashCode(de.t),
                ""+historyHash(m.T,labels),""+historyHash(ui.q,labels),""+historyHash(ma.j,labels),""+Arrays.hashCode(jg.z)));
        }
    }
    public static void main(String[] args)throws Exception{
        if (args.length != 0 && args[0].equals("history")) { historyWrites(); return; }
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        kc.a(new dd(bytes(in.readLine())),122);
        al local=new al(new Source(in.readLine()),false,true),global=new al(new Source(in.readLine()),false,true);
        bc.a(global,null,1,local);rc.a(local,global,(byte)-6);
        al enums=new al(new Source(in.readLine()),false,true),objects=new al(new Source(in.readLine()),false,true);
        h.a(-17017,enums);bj.a(objects,-100,true,null,null);
        cd decoder=new cd();
        qk.v.a(new int[]{1,2,3,4},0);
        pb actor=new pb();actor.Gc=vb.a("Alice", (byte)100);actor.pc=new cl();te.g=actor;
        for(String l;(l=in.readLine())!=null;){
            String[] p=l.split(" ",-1);
            switch(p[0]){
                case "script":System.out.println(run(p,true));break;
                case "long":
                    try{System.out.println(str(fd.a(num(p[1]),Long.parseLong(p[2]),num(p[3])!=0,num(p[4]))));}
                    catch(RuntimeException ex){System.out.println("threw");} break;
                case "decimal":System.out.println(str(ph.a(-1,Long.parseLong(p[1]))));break;
                case "decoder":System.out.println(str(decoder.a((byte)-100,Long.parseLong(p[2]),num(p[1]),new int[]{num(p[3])})));break;
                case "category":System.out.println(category(num(p[1])));break;
                case "phrase":System.out.println(phrase(num(p[1])));break;
                case "policy":
                    ld.g=num(p[1])!=0;d.h=num(p[2])!=0;qi.Z=num(p[3])!=0;mi.E=num(p[4]);se.x=num(p[5]);n.h=num(p[6]);pi.r[0]=actor.Gc.b((byte)-16);
                    System.out.println("ok");break;
                case "language":hl.w=num(p[1]);ii.a((byte)127,hl.w);System.out.println("ok");break;
                case "area":hk.e=num(p[1]);vj.t=num(p[2]);actor.Z=num(p[3]);actor.S=num(p[4]);ma.a((byte)-70);System.out.println(se.x);break;
                case "recv":receive(num(p[1]),bytes(p[2]));System.out.println(chatLog()+"|"+hd.b.yb);break;
                case "faultRecv":System.out.println(receiveFault(p));break;
                case "public":{
                    hd.b.yb=0;byte[] b=bytes(p[1]);System.arraycopy(b,0,hd.b.fb,0,b.length);
                    actor.pc=num(p[2])!=0?new cl():null;
                    il.a(1,actor,-100,128);
                    System.out.println(chatLog()+"|"+str(actor.P)+"|"+actor.mb+","+actor.ub+","+actor.Nb+"|"+hd.b.yb);break;
                }
            }
        }
    }
}
