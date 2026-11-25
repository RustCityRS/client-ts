import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.*;

class FramebufferOracle {
    public static void main(String[] args) throws Exception {
        DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out));
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=in.readLine())!=null;) {
            String[] input=line.split(" ");
            int[] n=Arrays.stream(input).skip(1).mapToInt(Integer::parseInt).toArray();
            switch(input[0]) {
                case "new" -> {
                    int[] pixels=new int[n[0]*n[1]];
                    for(int i=0;i<pixels.length;i++) pixels[i]=n[2]^i*0x35b7c295;
                    td.a(pixels,n[0],n[1]);
                }
                case "clip" -> td.b(n[0],n[1],n[2],n[3]);
                case "intersect" -> td.a(n[0],n[1],n[2],n[3]);
                case "rect" -> td.c(n[0],n[1],n[2],n[3],n[4]);
                case "fill" -> td.d(n[0],n[1],n[2],n[3],n[4]);
                case "line" -> td.f(n[0],n[1],n[2],n[3],n[4]);
                case "over" -> td.b(n[0],n[1],n[2],n[3],n[4],n[5]);
                case "circle" -> td.a(n[0],n[1],n[2],n[3],n[4]);
                case "clear" -> td.b();
                default -> throw new AssertionError(line);
            }
            ByteBuffer frame=ByteBuffer.allocate(td.g.length*4).order(ByteOrder.LITTLE_ENDIAN);
            frame.asIntBuffer().put(td.g);
            out.write(frame.array());
        }
        out.flush();
    }
}
