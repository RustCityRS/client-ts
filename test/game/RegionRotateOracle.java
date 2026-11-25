import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.StringTokenizer;

public final class RegionRotateOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(System.out);
        String line;
        while ((line = input.readLine()) != null) {
            StringTokenizer tokens = new StringTokenizer(line);
            int x = Integer.parseInt(tokens.nextToken());
            int z = Integer.parseInt(tokens.nextToken());
            int width = Integer.parseInt(tokens.nextToken());
            int length = Integer.parseInt(tokens.nextToken());
            int locAngle = Integer.parseInt(tokens.nextToken());
            int rotation = Integer.parseInt(tokens.nextToken());
            int next = Integer.parseInt(tokens.nextToken());
            int selector = Integer.parseInt(tokens.nextToken());

            // These calls retain the argument order at lk.a and ck.a in the 530 JAR.
            int tileX = g.a(rotation, selector, z, x);
            int tileZ = bf.a(rotation, z, (byte) -88, x);
            int locX = ca.a(0, z, x, length, locAngle, width, rotation);
            int locZ = qd.a(rotation, width, z, length, 15, locAngle, x);
            int placedAngle = (locAngle + rotation) & 3;
            int nextTileX = g.a(next, 2, tileZ, tileX);
            int nextTileZ = bf.a(next, tileZ, (byte) -88, tileX);
            int nextLocX = ca.a(0, locZ, locX, length, placedAngle, width, next);
            int nextLocZ = qd.a(next, width, locZ, length, 15, placedAngle, locX);
            out.println(tileX + " " + tileZ + " " + locX + " " + locZ + " " +
                nextTileX + " " + nextTileZ + " " + nextLocX + " " + nextLocZ);
        }
        out.flush();
    }
}
