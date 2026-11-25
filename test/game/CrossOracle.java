import java.util.*;
public class CrossOracle {
    public static void main(String[] args) {
        int[] screen=new int[53*38];
        td.a(screen,53,38);
        vc[] crosses=new vc[8];
        for(int i=0;i<8;i++){
            int[] colour=new int[9*7];
            for(int p=0;p<colour.length;p++)colour[p]=(p+i)%5==0?0:(i+1)*65536+p+1;
            crosses[i]=new rh(16,16,i&1,i&3,9,7,colour);
        }
        pb self=new pb();
        int[] ticks={Integer.MIN_VALUE,-100,-99,-1,0,99,100,299,300,399,400,Integer.MAX_VALUE};
        for(int mode=-1;mode<=3;mode++)for(int step:ticks)for(int i=0;i<9;i++){
            df.J=mode;jh.r=step;sb.a=i%3==0?0:i%3==1?28:Integer.MIN_VALUE;kg.K=i%3==0?11:33;
            di.m=i==0?null:i==1?new vc[8]:crosses;
            te.g=i==2?null:self;hk.e=i==3?3052:i==4?3071:3138;vj.t=i==4?9491:i==5?3008:3061;
            self.Z=128;self.S=128;se.x=73;Arrays.fill(screen,123456);
            boolean error=false;
            try {qa.a(234,-14,7,29,7);}catch(RuntimeException e){error=true;}
            System.out.println(error+" "+se.x+" "+Arrays.hashCode(screen));
        }
    }
}
