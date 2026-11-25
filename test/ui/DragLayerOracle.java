import java.io.*;
import java.util.*;

class DragLayerOracle {
    static final int GROUP = 1 << 16;
    static final aj[] nodes = new aj[9];

    static int index(aj widget) {
        return widget == null ? -1 : Arrays.asList(nodes).indexOf(widget);
    }

    static final class Provider extends ud {
        int requests;
        final int mode;
        Provider(int mode) { this.mode = mode; }

        db b(int dummy) {
            requests++;
            if (mode == 1 && requests == 1 || mode == 2 && requests == 2)
                throw new IllegalStateException("index");
            if (mode == 3 && requests == 2) nodes[0].cd = nodes[7];
            return null;
        }
        byte[] a(int dummy, int group) { throw new AssertionError(); }
        void b(int dummy, int group) { throw new AssertionError(); }
        int c(int group, int dummy) { throw new AssertionError(); }
    }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op=v[0], depth=v[1], mode=v[2], flags=v[3];
            Provider provider = new Provider(v[4]);
            kh.A = new al(provider,true,true);
            for (int i=0; i<nodes.length; i++) {
                aj w = nodes[i] = new aj();
                w.Kc=GROUP+i; w.n=GROUP+i+1;
            }
            aj w = nodes[0];
            w.bc=(flags&1)==0 ? -1 : 2;
            w.Sc=new l(depth<<18,-1);
            w.cd=(flags&2)==0 ? null : nodes[8];
            fd.W=new nc(8);
            if ((flags&4)!=0) fd.W.a((byte)-89,new l(((depth+3)&7)<<18,42),((long)w.Kc<<32)+w.bc);
            fk.ab=new aj[][]{null,nodes.clone()}; rg.b=new boolean[]{false,true};
            if (mode==1) fk.ab[1][3]=null;
            if (mode==2) nodes[2].n=2<<16;
            if (mode==3) nodes[1].n=nodes[1].Kc;
            if (mode==4) w.n=0;
            if (mode==5) w.Sc=null;
            pe.T=(flags&8)==0 ? null : nodes[3];
            ie.F=(flags&16)!=0;
            vf.Y=nodes[4]; c.A=-17; c.s=509; h.a=78; ed.h=true;
            aj result=null;
            String fault="ok";
            try {
                if (op==0) result=client.c(w);
                else if (op==1) result=sd.a(w,255);
                else client.a(v[5],(byte)61,op==3?null:w,v[6]);
            } catch (RuntimeException e) {
                Throwable cause=e;
                while(cause instanceof g) cause=((g)cause).a;
                fault=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":
                    cause instanceof IllegalStateException?"index":"other";
            }
            System.out.println(fault+" "+index(result)+" "+index(pe.T)+" "+index(vf.Y)+" "+c.A+" "+c.s+" "+h.a+" "+ed.h+" "+provider.requests);
        }
    }
}
