import java.io.*;
import java.util.*;

class ClientVarOracle {
    static final long APPLY=1L<<62;
    public static void main(String[] args)throws Exception{
        var lines=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=lines.readLine())!=null;){
            int[] row=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op=row[0],index=row[1],code=row[2],cache=row[6],node=row[7],value=row[8];
            vj.d=row[3]<0?null:new int[row[3]];oc.c=row[4]<0?null:new int[row[4]];
            if(vj.d!=null)Arrays.fill(vj.d,83);if(oc.c!=null)Arrays.fill(oc.c,549);
            gg.y=2;vf.S.a(0);cd.d.a(0);
            ba.g=ma.g=null;
            bb base=new bb();vf.S.a(0L,base,(byte)-71);
            bb cfg=new bb();cfg.d=code;
            og bit=new og();bit.j=index;bit.d=code;bit.i=row[5];
            if(cache!=1){
                vf.S.a((long)index,cache==2?new Object():cfg,(byte)-71);
                cd.d.a(46L,cache==2?new Object():bit,(byte)-71);
            }
            db.p=node==4?null:new nc(16);
            jf previous=node==1?new jf():node==2?new ui(APPLY|1L):node==3?new ui(1L):null;
            if(previous!=null)db.p.a((byte)-89,previous,(long)index);
            d.q=17;j.h=21;ff.q=25;
            String result="-";
            try {
                switch(op){
                    case 0:wi.a(index,-39);break;
                    case 1:bj.a((byte)67);break;
                    case 2:ae.a(122,index,value);break;
                    case 3:be.a(10,index,value);break;
                    case 4:result=Integer.toString(v.a(-31374,true));break;
                    case 5:result=Integer.toString(ie.a(22255,46));break;
                    case 6:se.a(46,0,value);break;
                    case 7:oi.a(value,124,46);break;
                }
            }catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap&&wrap.a!=null)cause=wrap.a;
                result=cause instanceof NullPointerException?"null":cause instanceof ClassCastException?"cast":
                    cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getName();
            }
            jf current=db.p==null?null:db.p.a((byte)-100,(long)index);
            String queue=current instanceof ui x?(x.B==(APPLY|1L)?"immediate":x.B==1?"expired":(x.B&APPLY)!=0?"server":"client"):current==null?"-":"other";
            System.out.println(result+" "+Arrays.hashCode(vj.d)+" "+Arrays.hashCode(oc.c)+" "+d.q+" "+j.h+" "+ff.q+" "+
                (db.p==null?-1:db.p.d((byte)-107))+" "+queue+" "+(current==previous));
        }
    }
}
