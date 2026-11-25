import java.lang.reflect.Array;
import java.util.*;

public class ArrayUtilsOracle {
    static String values(Object a){
        if(a==null)return "-";
        StringJoiner out=new StringJoiner(",");
        for(int i=0;i<Array.getLength(a);i++)out.add(String.valueOf(Array.get(a,i)));
        return out.toString();
    }
    static Object array(int kind, int salt){
        int n=16;
        switch(kind){
            case 0: {byte[] a=new byte[n];for(int i=0;i<n;i++)a[i]=(byte)(i+salt);return a;}
            case 1: {short[] a=new short[n];for(int i=0;i<n;i++)a[i]=(short)(i+salt);return a;}
            case 2: {long[] a=new long[n];for(int i=0;i<n;i++)a[i]=Long.MIN_VALUE+i+salt;return a;}
            case 3: {Object[] a=new Object[n];for(int i=0;i<n;i++)a[i]=i%4==0?null:"v"+(i+salt);return a;}
            default: {int[] a=new int[n];for(int i=0;i<n;i++)a[i]=i+salt;return a;}
        }
    }
    public static void main(String[] args){
        int[][] ranges={{0,0,0},{0,0,16},{0,2,12},{3,0,13},{2,3,7},{2,5,8},{2,5,9},{0,9,8},{12,9,8},
            {-1,0,1},{0,-1,1},{5,5,-1},{Integer.MAX_VALUE,0,7},{0,1,Integer.MIN_VALUE},{15,14,2}};
        for(int kind=0;kind<8;kind++)for(int shape=0;shape<5;shape++)for(int[] r:ranges){
            Object s=shape>2?null:array(kind,1),d=shape==1?s:shape==2||shape==4?null:array(kind,31),copy=null;
            String error="ok";int a=r[0],b=r[1],n=r[2];
            try{
                switch(kind){
                    case 0:cc.a((byte[])s,a,(byte[])d,b,n);break;
                    case 1:cc.a((short[])s,a,(short[])d,b,n);break;
                    case 2:cc.a((long[])s,a,(long[])d,b,n);break;
                    case 3:cc.a((Object[])s,a,(Object[])d,b,n);break;
                    case 4:cc.a((int[])s,a,(int[])d,b,n);break;
                    case 5:cc.a((int[])d,b,n);break;
                    case 6:cc.a((int[])d,b,n,-123);break;
                    case 7:copy=ok.a((int[])s,false);if(copy!=null)((int[])copy)[7]=-99;break;
                }
            }catch(RuntimeException e){error=e instanceof NullPointerException?"null":"bounds";}
            System.out.println(error+"|"+values(s)+"|"+values(d)+"|"+values(copy));
        }
    }
}
