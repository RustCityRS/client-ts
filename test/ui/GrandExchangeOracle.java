import java.io.*;
import java.net.Socket;
import java.util.*;

class GrandExchangeOracle {
    static final int[] OPS={3903,3904,3905,3906,3907,3908,3910,3911,3912,3913};
    static void receive(byte[] bytes) throws Exception {
        Socket socket=new Socket(){
            public void setSoTimeout(int n){}
            public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(socket,null); o.Y=116; af.I=bytes.length;
        if(!rg.a((byte)57))throw new AssertionError("packet was not consumed");
    }
    static void scriptEdges() throws Exception {
        rb.h = new ea[6];
        rb.h[1] = new ea();
        PrintStream console = System.out;
        for (int opcode = 3903; opcode <= 3913; opcode++) {
            for (int slot : new int[]{-1, 0, 1, 6}) {
                m script = new m();
                script.D = new int[]{0, opcode, 0, 21};
                script.F = new int[]{slot, 0, 91055, 0};
                script.B = new id[4];
                int id = 8410 + opcode * 8 + slot;
                sf.g.a((long) id, 0, script);
                wf event = new wf();
                event.G = new Object[]{id};
                Arrays.fill(tg.B, -11017);
                try (PrintStream quiet = new PrintStream(OutputStream.nullOutputStream())) {
                    System.setOut(quiet);
                    gh.a(event,-22368,200000);
                } finally { System.setOut(console); }
                console.println(Arrays.toString(Arrays.copyOf(tg.B,3)));
            }
        }
    }
    public static void main(String[] args) throws Exception {
        m script=new m();script.D=new int[OPS.length*3+1];script.F=new int[script.D.length];script.B=new id[script.D.length];script.E=1;
        for(int i=0;i<OPS.length;i++){script.D[3*i]=33;script.D[3*i+1]=OPS[i];script.D[3*i+2]=43;script.F[3*i+2]=i;}
        script.D[3*OPS.length]=21;sf.g.a(8401L,0,script);
        for(int i=0;i<6;i++)rb.h[i]=new ea();
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            byte[] bytes=HexFormat.of().parseHex(line);int slot=bytes[0]&255;
            ea old=rb.h[slot];bb.e+=12345;receive(bytes);ea c=rb.h[slot];int pos=hd.b.yb;
            wf e=new wf();e.G=new Object[]{8401,slot};li.a(e,116);
            System.out.println((c!=old)+" "+pos+" "+pi.p+" "+c.a((byte)-43)+" "+c.b(-121)+" "+Arrays.toString(Arrays.copyOf(od.U,OPS.length)));
        }
        scriptEdges();
    }
}
