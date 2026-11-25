import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Exercises the original unmodified 530 PCM classes. Each input row performs one
// operation and reports the samples and persistent state after that operation.
public class PcmOracle {
    static final byte[] samples = new byte[23];
    static jc stream;
    static final cj mixer = new cj();
    static int[] output;
    static final Field[] fields = new Field[15];
    static Field field(Class<?> type, String name) throws Exception {
        Field f = type.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    public static void main(String[] args) throws Exception {
        for (int i = 0; i < samples.length; i++) samples[i] = (byte)(i * 79 - 77);
        for (int i = 0; i < fields.length; i++) fields[i] = field(jc.class,"uvwxyzABCDEFGHI".substring(i,i+1));
        BufferedReader commands = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = commands.readLine()) != null;) {
            String[] argsIn = line.split(" ");
            int[] n = new int[argsIn.length];
            for (int i = 1; i < n.length; i++) n[i] = Integer.parseInt(argsIn[i]);
            String answer = "";
            try {
                switch (argsIn[0]) {
                    case "resample": {
                        hd resampler = new hd(n[1],n[2]);
                        ji sound = new ji(n[3],samples,n[4],n[5],n[6]!=0);
                        ji result = sound.a(resampler);
                        int[][] table = (int[][])field(hd.class,"d").get(resampler);
                        System.out.println(Arrays.deepHashCode(table)+" "+Arrays.hashCode(result.r)+" "+(result.r==samples)+" "+(result==sound)+" "+result.t+" "+result.s+" "+result.v+" "+result.u);
                        continue;
                    }
                    case "new": {
                        if(stream!=null) mixer.b(stream);
                        db.v = n[1]!=0;
                        mj.e = 22050;
                        ji sound = new ji(22050,samples,n[2],n[3],n[4]!=0);
                        stream = jc.a(sound,n[5],n[6],n[7]);
                        mixer.a(stream);
                        break;
                    }
                    case "factory": {
                        if(stream!=null) mixer.b(stream);
                        ji sound = new ji(n[1],samples,3,16);
                        mj.e=n[2]; db.v=false;
                        stream=jc.a(sound,n[3],n[4]);
                        mixer.a(stream);
                        break;
                    }
                    case "loops": stream.b(n[1]); break;
                    case "position": stream.c(n[1]); break;
                    case "reverse": stream.b(n[1]!=0); break;
                    case "speed": stream.f(n[1]); break;
                    case "volume": stream.g(n[1]); break;
                    case "rampVolume": stream.c(n[1],n[2]); break;
                    case "ramp": stream.a(n[1],n[2],n[3]); break;
                    case "fade": stream.d(n[1]); break;
                    case "active": stream.q=n[1]!=0; break;
                    case "skip": mixer.a(n[1]); break;
                    case "directSkip": stream.a(n[1]); break;
                    case "fill": case "directFill": {
                        output = n[1]<0 ? null : new int[n[1]];
                        if(output!=null) for(int i=0;i<output.length;i++) output[i]=Integer.MAX_VALUE - 1003*i;
                        if(argsIn[0].equals("fill")) mixer.b(output,n[2],n[3]); else stream.b(output,n[2],n[3]);
                        break;
                    }
                    default: throw new AssertionError(line);
                }
            } catch (ArrayIndexOutOfBoundsException e) {answer="bounds";}
              catch (NullPointerException e) {answer="null";}
              catch (ArithmeticException e) {answer="arithmetic";}
            StringBuilder result = new StringBuilder(answer+"|"+Arrays.toString(output)+"|");
            output=null;
            for(Field f:fields) result.append(f.get(stream)).append(' ');
            result.append(stream.a((byte)-100)).append(' ').append(stream.c()).append(' ').append(stream.d()).append(' ').append(stream.e()).append(' ').append(stream.i()).append(' ').append(stream.j()).append(' ').append(stream.k()).append(' ').append(stream.l());
            System.out.println(result);
        }
    }
}
