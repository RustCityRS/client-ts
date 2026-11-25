import java.io.*;
import java.util.*;

class AnimationConfigOracle {
    static void configs(DataInputStream in) throws Exception {
        for (int kind=0; kind<3; kind++) {
            EntityConfigOracle.Provider provider = new EntityConfigOracle.Provider(in);
            al archive = new al(provider,false,false);
            Class<?> cls = kind == 0 ? mg.class : kind == 1 ? ek.class : li.class;
            EntityConfigOracle.Fields raw = new EntityConfigOracle.Fields(cls), loaded = new EntityConfigOracle.Fields(cls);
            if (kind == 0) oa.a(49,archive);
            else if (kind == 1) hf.a(archive,archive,-124,archive);
            else nf.a(archive,archive,true);
            for (int group : provider.index.d) {
                if (kind == 0 && group != 32) continue;
                for (int file : archive.b(group,(byte)-103)) {
                    int id = kind == 0 ? file : (group << (kind == 1 ? 7 : 8)) | file;
                    byte[] bytes = archive.a(-809612665,file,group);
                    if (bytes == null) continue;
                    decode(kind,id,bytes,raw);
                    Object value = switch(kind) {case 0 -> af.a(false,id); case 1 -> tb.b(id,-32); default -> bf.b(-17177,id);};
                    loaded.add(value,0);
                }
            }
            int n=in.readInt();
            for (int i=0;i<n;i++) decode(kind,0x530,in.readNBytes(in.readInt()),raw);
            raw.print(); loaded.print();
        }
    }

    static void decode(int kind,int id,byte[] bytes,EntityConfigOracle.Fields fields) throws Exception {
        gd p=new gd(bytes);
        Object value=kind==0?new mg():kind==1?new ek():new li();
        int pos;
        try {
            if(value instanceof mg v) v.a(p,0);
            else if(value instanceof ek v) { v.f=id; v.a((byte)124,p); }
            else { li v=(li)value; v.d=id; v.a(false,p); }
            pos=p.yb;
        } catch(RuntimeException ex) { pos=~p.yb; }
        fields.add(value,pos);
    }

    static ek seq(int id,int replay,int loops,int preMove) {
        ek v=new ek(); v.f=id;
        v.g=new int[]{500,501,502}; v.F=new int[]{0,1,3}; v.H=new int[3][];
        for(int i=0;i<3;i++) v.H[i]=new int[]{(id+i)<<8|33};
        v.G=2; v.a=loops; v.b=replay; v.o=preMove; v.E=true; v.b(107);
        ga.B.a((long)id,v,(byte)-71); return v;
    }

    static void actor() throws Exception {
        int action=23000, walk=23010, spot=23020;
        pb actor = new pb(); te.g=actor; dd.u=127;
        seq(action,1,2,1); seq(walk,0,99,0); seq(spot,2,1,0);
        ek empty=seq(23030,2,1,0); empty.g=new int[0]; empty.F=new int[0]; empty.H=null;
        ek missing=seq(23031,2,1,0); missing.g=null; missing.F=null; missing.H=null;
        li type=new li(); type.k=spot; type.d=19000; r.V.a(19000L,type,(byte)-71);
        actor.M=walk; actor.fb=19000; actor.t=3; actor.lb=-1;
        actor.bb=action; actor.gc=3; actor.T=1;
        ci previous=null;
        for(int tick=1;tick<=24;tick++) {
            ag.l=0; hh.kb=tick;
            if(tick==1) pi.a((byte)-100,new int[]{action,walk,spot},new int[]{1,0,0},actor,new int[]{1,2,4});
            if(tick==2 || tick==4) {
                previous=actor.pb[0];
                pi.a((byte)-100,new int[]{action,walk,spot},new int[]{2,2,2},actor,new int[]{1,2,4});
            }
            if(tick==7) actor.T=0;
            if(tick==15) pi.a((byte)-100,new int[]{23030,23031},new int[]{0,0},actor,new int[]{1,2});
            if(tick==19) {actor.M=actor.bb=23030; actor.gc=0; actor.Xb=0; actor.yb=0;}
            if(tick==20) actor.bb=actor.M=23031;
            ud.a((byte)124,actor);
            StringJoiner str=new StringJoiner("|");
            str.add(Arrays.toString(new int[]{actor.M,actor.yb,actor.J,actor.O,actor.fb,actor.lb,actor.E,actor.Ub,
                actor.bb,actor.Xb,actor.hb,actor.w,actor.fc,actor.gc,actor.r?1:0,previous==actor.pb[0]?1:0}));
            for(int i=0;i<3;i++){
                ci slot=actor.pb[i];
                str.add(slot==null?"null":Arrays.toString(new int[]{slot.e,slot.f,slot.n,slot.a,slot.d,slot.j}));
            }
            str.add(Arrays.toString(Arrays.copyOf(ff.J,ag.l)));
            System.out.println(str);
        }
    }
    static void movement() {
        mg bas=new mg();
        int id=23100;
        bas.C=id;bas.z=id+1;bas.v=id+2;bas.y=id+3;bas.a=id+4;bas.u=id+5;bas.R=id+6;bas.A=id+7;bas.L=id+8;bas.n=id+9;
        bas.P=id+38;bas.b=id+39;bas.i=id+40;bas.k=id+41;bas.m=id+42;
        for(int i=0;i<43;i++)seq(id+i,2,2,0);
        ig.n.a(19001L,bas,(byte)-71);
        for(int scenario=0;scenario<32;scenario++){
            pb actor=te.g=new pb();actor.U=19001;
            actor.L[0]=actor.ac[0]=50;actor.Z=actor.S=50*128+64;
            actor.gb=(scenario*113)&2047;actor.Rb=actor.gb<<5;
            bas.J=(scenario&8)!=0?131:0;bas.f=(scenario&16)!=0?65530:431;
            bas.t=(scenario&4)!=0?35:-1;
            for(int tick=1;tick<=48;tick++){
                if(tick==1||tick==15||tick==33){
                    int dir=(scenario+tick/10)&7;
                    int dx=new int[]{-1,0,1,-1,1,-1,0,1}[dir], dz=new int[]{1,1,1,0,0,-1,-1,-1}[dir];
                    actor.F=1;actor.L[0]=(actor.Z>>7)+dx;actor.ac[0]=(actor.S>>7)+dz;
                    actor.D[0]=(byte)((scenario+tick)%3);
                }
                if(tick==22){actor.F=0;actor.N=(actor.gb+(scenario%2==0?370:-370))&2047;}
                hh.kb=tick;ag.l=0;gk.a(-1,0,actor);
                int[] row={actor.Z,actor.S,actor.gb,actor.N,actor.F,actor.bc,actor.xb,actor.M,actor.yb,actor.J,actor.O,
                    actor.Yb,actor.Rb,actor.qb,actor.z,actor.wb,actor.Jb,actor.Mb?1:0};
                System.out.println(Arrays.toString(row));
            }
        }
    }
    public static void main(String[] args) throws Exception {
        configs(new DataInputStream(new BufferedInputStream(System.in)));
        actor();
        movement();
    }
}
