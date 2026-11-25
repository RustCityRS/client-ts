import java.io.*;
import java.net.Socket;
import java.util.*;

class LocMergeOracle {
    static final int x=37,z=55;
    static final ug[] entities={new ig(),new ig(),new ig(),new ig()};

    static void read(int opcode,byte[] bytes)throws Exception {
        Socket socket=new Socket(){
            public void setSoTimeout(int timeout){} public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(socket,null);o.Y=opcode;af.I=bytes.length;
        if(!rg.a((byte)57))throw new AssertionError("packet not consumed");
    }

    static String merge(jk m){
        return String.join(",",Integer.toString(m.B),Integer.toString(m.D),Integer.toString(m.t),Integer.toString(m.v),
            Integer.toString(m.u),Integer.toString(m.y),Integer.toString(m.z),Integer.toString(m.q),
            Integer.toString(m.x),Integer.toString(m.s),Integer.toString(m.C),Integer.toString(m.E));
    }
    static String queue(){
        StringJoiner rows=new StringJoiner("/");
        for(jk m=(jk)nl.Q.d(0);m!=null;m=(jk)nl.Q.a(0))rows.add(merge(m));
        return rows.toString();
    }
    static String actor(ob a){
        return Arrays.asList(entities).indexOf(a.nb)+","+a.ib+","+a.Cb+","+a.Wb+","+a.y+","+a.k+","+a.tb+","+a.Lb+","+a.jb+","+a.hc;
    }
    static String changes(){
        StringJoiner rows=new StringJoiner("/");
        for(ff c=(ff)wh.S.d(0);c!=null;c=(ff)wh.S.a(0))
            rows.add(c.r+","+c.t+","+c.w+","+c.z+","+c.B+","+c.C+","+c.D+","+c.F+","+c.K+","+c.L+","+c.N+","+c.O);
        return rows.toString();
    }
    static void setTile(int level, int mask){
        ra tile=kl.Bb[level][x][z]=new ra(level,x,z);
        for(int layer=0;layer<4;layer++){
            long key=((long)(501+layer)<<32)|((long)2<<29)|((long)(4+layer)<<14)|((long)layer<<20)|(z<<7)|x;
            ug e=(mask&(1<<layer))!=0?entities[layer]:null;
            switch(layer){
                case 0:tile.z=new hk();tile.z.f=key;tile.z.i=e;break;
                case 1:tile.C=new nf();tile.C.a=key;tile.C.i=e;break;
                case 2:
                    tile.t=3;
                    tile.H[0]=new ec();tile.H[0].u=0;tile.H[0].a=x;tile.H[0].m=z;tile.H[0].z=entities[0];
                    tile.H[1]=new ec();tile.H[1].u=key;tile.H[1].a=x-1;tile.H[1].m=z;tile.H[1].z=entities[0];
                    tile.H[2]=new ec();tile.H[2].u=key;tile.H[2].a=x;tile.H[2].m=z;tile.H[2].z=e;break;
                case 3:tile.u=new pk();tile.u.e=key;tile.u.d=e;break;
            }
        }
    }
    public static void main(String[] args)throws Exception {
        kl.Bb=new ra[4][104][104];ve.q=new int[4][105][105];
        for(int l=0;l<4;l++)for(int a=0;a<105;a++)for(int b=0;b<105;b++)ve.q[l][a][b]=(a*17777777)^(b*172972831)^(l*-1131351479);
        mi.y=73;
        try(BufferedReader lines=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=lines.readLine())!=null;){
                String[] v=line.split(" ");
                int level=Integer.parseInt(v[0]);
                dg.C=32;ha.a=48;ah.f=(level+1)&3;hh.kb=Integer.parseInt(v[1]);
                nl.Q.b((byte)125);wh.S.b((byte)125);
                te.g=new pb();tf.J[10]=new pb();uc.l[9]=new bk();
                jb type=new jb();type.fb=Integer.parseInt(v[2]);type.y=Integer.parseInt(v[3]);
                he.w.a(17771L,type,(byte)-71);
                setTile(level,Integer.parseInt(v[4]));
                for(int i=5;i<v.length;i++){
                    String[] packet=v[i].split(":");read(Integer.parseInt(packet[0]),HexFormat.of().parseHex(packet[1]));
                }
                String before=queue(),failure="ok";ah.f=level;
                try{sg.a((byte)-24);}catch(g error){failure=error.a.getClass().getSimpleName()+"@"+error.q;}
                System.out.println(before+";"+failure+";"+queue()+";"+actor(te.g)+"/"+actor(tf.J[10])+"/"+actor(uc.l[9])+";"+changes());
            }
            nl.Q.b((byte)125);
            jf wrong = new jf();
            jk next = new jk();
            nl.Q.a(wrong, false);
            nl.Q.a(next, false);
            String failure = "ok";
            try { sg.a((byte)-24); }
            catch (g error) { failure = error.a.getClass().getSimpleName()+"@"+error.q; }
            System.out.println(failure + "/" + (wrong.g != null) + "/" + (nl.Q.d(0) == next));
        }
    }
}
