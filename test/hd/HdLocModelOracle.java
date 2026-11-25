import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Path;
import java.util.Arrays;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.IdentityHashMap;

/** Executes pb's original public static-scene and animated hardware model requests on cache archives. */
public class HdLocModelOracle {
    static final IdentityHashMap<Object,Integer> identities = new IdentityHashMap<>();
    static final int[][] ground = new int[32][32], upperGround = new int[32][32];
    static final ek reusableShadow = new ek(256,256,0);

    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static int id(Object object) {
        if (object == null) return 0;
        return identities.computeIfAbsent(object, unused -> identities.size() + 1);
    }

    static String digest(Object array) throws Exception {
        if (array == null) return "-";
        int count = Array.getLength(array);
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] bytes = new byte[count * 4];
        for (int i = 0; i < count; i++) {
            int value = Array.getInt(array,i);
            bytes[4*i] = (byte)(value >>> 24);
            bytes[4*i+1] = (byte)(value >>> 16);
            bytes[4*i+2] = (byte)(value >>> 8);
            bytes[4*i+3] = (byte)value;
        }
        return HexFormat.of().formatHex(sha.digest(bytes));
    }

    static String result(sm entity) throws Exception {
        if (entity == null) return "null";
        StringBuilder out = new StringBuilder().append(id(entity)).append('|').append(id(entity.j)).append('|').append(id(entity.a));
        if (entity.j != null) {
            td model = (td)entity.j;
            out.append('|').append(model.u).append(',').append(model.n()).append(',').append(model.t()).append(',').append(model.I);
            for (String name : new String[]{"S","lb"}) out.append(',').append(field(td.class,name).getInt(model));
            for (String name : new String[]{"H","eb","hb","w","P","Q","t","B"}) out.append('|').append(digest(field(td.class,name).get(model)));
        }
        if (entity.a != null) {
            ek sprite = entity.a;
            out.append('|').append(sprite.l).append(',').append(sprite.i).append(',').append(sprite.m).append(',').append(sprite.d)
                .append(',').append(sprite.a).append(',').append(sprite.k).append('|').append(digest(sprite.o));
        }
        return out.toString();
    }

    static pb definition(int id, int variant, int shape) throws Exception {
        pb original = wc.a(4,id);
        pb loc = new pb();
        for (Field f : pb.class.getDeclaredFields()) {
            if (!Modifier.isStatic(f.getModifiers())) {
                f.setAccessible(true);
                f.set(loc,f.get(original));
            }
        }
        loc.hb += variant * 100000;
        if (variant == 1) {
            for (String name : new String[]{"d","o","g","w","N","qb","u","p"}) {
                field(pb.class,name).setInt(loc,switch(name) {
                    case "d" -> 110; case "o" -> 144; case "g" -> 98; case "w" -> 33; case "N" -> -7; case "qb" -> 6; case "u" -> -12; default -> 27;
                });
            }
            field(pb.class,"sb").setBoolean(loc,true);
            field(pb.class,"zb").setBoolean(loc,true);
            field(pb.class,"n").set(loc,new int[]{shape});
            field(pb.class,"b").set(loc,new short[]{5546,0,12});
            field(pb.class,"H").set(loc,new short[]{1,2,3});
            field(pb.class,"P").set(loc,new byte[]{0,0,0});
            field(pb.class,"a").set(loc,new short[]{-1});
            field(pb.class,"v").set(loc,new short[]{-1});
        } else if (variant == 2) {
            field(pb.class,"b").set(loc,new short[]{5546,0});
            field(pb.class,"H").set(loc,new short[]{1});
        } else if (variant == 3) {
            field(pb.class,"X").set(loc,new int[]{731,731,731,731,731});
            field(pb.class,"n").set(loc,null);
        } else if (variant >= 4 && variant <= 8) {
            field(pb.class,"G").setByte(loc,(byte)(variant - 3));
            field(pb.class,"A").setShort(loc,(short)0x4480);
        } else if (variant == 9) {
            field(pb.class,"X").set(loc,new int[0]);
            field(pb.class,"n").set(loc,null);
        }
        return loc;
    }

    static void run(int[] args) throws Exception {
        int locId = args[0], shape = args[1], angle = args[2], variant = args[3], mask = args[4], animation = args[5];
        boolean temp = (mask & 1) != 0, shadow = (mask & 2) != 0, shared = (mask & 4) != 0;
        ek sprite = (mask & 8) == 0 ? null : reusableShadow;
        pb loc = definition(locId,variant,shape);
        String status = "ok";
        sm entity;
        try {
            if (temp) {
                tk seq = animation == -1 ? null : client.a(animation,(byte)-20);
                entity = loc.a(1536,1664,sprite,-180,seq,angle,ground,shadow,0,8308,upperGround,1,shape,1);
            } else {
                entity = loc.a(angle,1664,ground,shape,-180,upperGround,shared,sprite,(byte)-75,shadow,1536);
            }
        } catch (RuntimeException error) {
            Throwable cause = error instanceof ld wrapped ? wrapped.f : error;
            status = cause.getClass().getSimpleName();
            entity = ni.n;
        }
        System.out.println(status + " " + result(entity));
    }

    static void rotations(ve models) throws Exception {
        tk sequence = client.a(808, (byte)-20);
        for (int modelId : new int[]{2, 115, 543}) {
            for (boolean active : new boolean[]{false, true}) for (boolean normals : new boolean[]{false, true}) {
                for (int angle : new int[]{0, 1, 2, 3, -1, 5}) {
                    tf.w = active;
                    sequence.d = normals;
                    td model = new td(gb.a(models, modelId, 0), 64, 768, false);
                    model.o();
                    td result = (td)sequence.a(19749, 0, 1, model, angle, 2);
                    StringBuilder row = new StringBuilder("rotation " + modelId + " " + active + " " + normals + " " + angle);
                    for (String name : new String[]{"H", "eb", "hb", "v", "L", "W"}) {
                        Object array = field(td.class, name).get(result);
                        Object written = array instanceof int[] a ? Arrays.copyOf(a, result.I)
                            : Arrays.copyOf((short[])array, field(td.class, "S").getInt(result));
                        row.append(' ').append(digest(written));
                    }
                    System.out.println(row);
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(directory.resolve("main_file_cache.dat2"),5200);
        en refs = HdTitleFrameOracle.open(directory.resolve("main_file_cache.idx255"),6000);
        ge master = new ge(255,data,refs,500000);
        HdTitleFrameOracle.Disk[] disks = new HdTitleFrameOracle.Disk[28];
        ve[] archives = new ve[28];
        try {
            for (int id : new int[]{0,1,7,8,9,16,20,26}) {
                disks[id] = new HdTitleFrameOracle.Disk(master,data,directory,id);
                archives[id] = new ve(disks[id],false,false);
            }
            oi.a(2,archives[16],archives[7],true);
            lb.a(archives[1],archives[20],-77,archives[0]);
            hf.a(new nk(archives[9],archives[26],archives[8],20,false));
            tf.w = true;
            tf.C = false;
            od.c = true;
            mk.c = -136;
            mk.d = 224;
            for (int x = 0; x < 32; x++) {
                for (int z = 0; z < 32; z++) {
                    ground[x][z] = -80 - (x * x + 7 * z - 3 * x * z & 127);
                    upperGround[x][z] = ground[x][z] - (128 + x * 2 + z);
                }
            }
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = in.readLine()) != null;) {
                if (!line.isEmpty()) run(java.util.Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
            }
            rotations(archives[7]);
        } finally {
            for (HdTitleFrameOracle.Disk disk : disks) if (disk != null) disk.file.b(false);
            refs.b(false);
            data.b(false);
        }
    }
}
