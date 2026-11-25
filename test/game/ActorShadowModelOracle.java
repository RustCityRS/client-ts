import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.IdentityHashMap;
import java.util.StringJoiner;

// Calls kc.a directly. cb builds every cache miss and fc owns the singleton animation-copy destination.
// Archives 0 and 1 serve real frames/bases from the version-530 JS5 sector files.
public final class ActorShadowModelOracle {
    private static final int[][][] flat = new int[4][105][105], hills = new int[4][105][105];
    private static final byte[][][] clear = new byte[4][104][104], bridges = new byte[4][104][104];
    private static final IdentityHashMap<Object,Integer> ids = new IdentityHashMap<>();
    private static Field[] rows, bounds;
    private static Field numFaces, valid, spot;
    private static MessageDigest digest;

    private static int tag(Object object) {
        if (object == null) return 0;
        return ids.computeIfAbsent(object, key -> ids.size() + 1);
    }

    private static Field[] fields(String... names) throws Exception {
        Field[] found = new Field[names.length];
        for (int i = 0; i < names.length; i++) found[i] = ModelMeshOracle.field(fc.class,names[i]);
        return found;
    }

    private static String bounds(fc mesh) throws Exception {
        if (mesh == null) return "-";
        StringJoiner result = new StringJoiner(",");
        result.add(valid.getBoolean(mesh) ? "1" : "0");
        for (Field f : bounds) result.add(String.valueOf(f.getShort(mesh)));
        return result.toString();
    }

    private static String mesh(Object mesh) throws Exception {
        if (mesh == null) return "-";
        if (!(mesh instanceof fc)) return "other";
        fc model = (fc) mesh;
        StringJoiner result = new StringJoiner(";");
        result.add(Integer.toString(tag(model))).add(model.D+","+numFaces.getInt(model)).add(bounds(model));
        for (int i = 0; i < rows.length; i++) {
            Object row = rows[i].get(model);
            if (row == null) { result.add("-"); continue; }
            int length = Array.getLength(row);
            ByteBuffer bytes = ByteBuffer.allocate(length * 4);
            for (int j = 0; j < length; j++) bytes.putInt(Array.getInt(row,j));
            String full = HexFormat.of().formatHex(digest.digest(bytes.array()));
            int used = i < 3 ? model.D : numFaces.getInt(model);
            String live = full;
            if (used != length) {
                digest.update(bytes.array(),0,used * 4);
                live = HexFormat.of().formatHex(digest.digest());
            }
            result.add(tag(row)+"@"+full+"@"+live);
        }
        return result.toString();
    }

    private static long key(int size, int outerAlpha, int innerColour, int outerColour, int innerAlpha) {
        int low = (outerAlpha << 24) + size + (innerAlpha << 16);
        return ((long)outerColour << 48) + ((long)innerColour << 32) + low;
    }

    private static String run(int[] r) throws Exception {
        int z=r[0], size=r[1], outerAlpha=r[2], innerColour=r[3], outerColour=r[4], x=r[5], yaw=r[7], innerAlpha=r[8];
        int level=r[10], terrain=r[11], shape=r[12], frameMode=r[13], flags=r[14];
        if ((flags & 1) != 0) ml.w = new ve(32);
        long key = key(size,outerAlpha,innerColour,outerColour,innerAlpha);
        if ((flags & 2) != 0) ml.w.a(key,new Object(),(byte)-71);
        ve.q = terrain == 0 ? flat : terrain == 3 ? null : hills;
        tb.t = terrain == 2 ? bridges : terrain == 4 ? null : clear;
        ah.f = level;
        fc actor = new fc();
        int radius = shape == 1 ? 37 : 850;
        actor.D = 3;
        actor.U = new int[]{-radius, radius-6, 11};
        actor.q = new int[]{-5, 19, -7};
        actor.v = new int[]{radius-4, 17, 3-radius};
        if (shape == 2) actor = null;
        if (shape == 3) actor.U = new int[]{1};
        if (shape == 4) actor.D = 0;
        ek seq = null;
        int frame = 0;
        if (frameMode != 0) {
            seq = new ek();
            if (frameMode == 1) seq.g = null;
            if (frameMode == 2) seq.g = new int[0];
            if (frameMode == 3) seq.g = new int[]{63 << 16 | 1};
            if (frameMode == 4) seq.g = new int[]{16 << 16 | 7};
            if (frameMode == 5) seq.g = new int[]{15 << 16 | 65535};
            if (frameMode == 6) {seq.g = new int[]{15 << 16}; frame = -1;}
        }
        int samples = ml.r;
        String outcome = "ok";
        nd value = null;
        try {
            value = kc.a(z,size,actor,outerAlpha,innerColour,true,outerColour,seq,x,r[6]!=0,yaw,innerAlpha,frame,r[9]);
        } catch (RuntimeException error) {
            Throwable e = error;
            while (e instanceof g) e = ((g)e).a;
            if (e instanceof NullPointerException) outcome = "null";
            else if (e instanceof ArrayIndexOutOfBoundsException) outcome = "index:" + e.getMessage().split(" ")[1];
            else if (e instanceof ClassCastException) outcome = "cast";
            else throw error;
        }
        return String.join("|",outcome,Long.toString(key),Integer.toString(ml.w.b((byte)-14)),
            Integer.toString(ml.r-samples),bounds(actor),mesh(ml.w.a(key,false)),mesh(value),mesh(spot.get(null)));
    }

    public static void main(String[] args) throws Exception {
        rows = fields("U","q","v","r","N","J","t","R","l","M","L");
        bounds = fields("Q","B","p","w","S","o","s","C");
        valid = ModelMeshOracle.field(fc.class,"K");
        numFaces = ModelMeshOracle.field(fc.class,"y");
        spot = ModelMeshOracle.field(fc.class,"V");
        digest = MessageDigest.getInstance("SHA-256");
        ef.K = new al(new ModelMeshOracle.Provider(args[0],0),false,false);
        uk.d = new al(new ModelMeshOracle.Provider(args[0],1),false,false);
        for (int p=0;p<4;p++) for (int x=0;x<105;x++) for (int z=0;z<105;z++) {
            hills[p][x][z] = (p*131+x*7-z*11)*10001;
            if (x<104 && z<104 && (x+z)%3==0) bridges[p][x][z] = 2;
        }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line=in.readLine())!=null) System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
