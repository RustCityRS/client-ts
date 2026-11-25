import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

final class EntityTeleportLightingOracle {
    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> entity = Class.forName(hd ? "fe" : "ob");
        var player = Class.forName(hd ? "e" : "pb").getDeclaredConstructor();
        player.setAccessible(true);
        Field local = field(hd ? "nk" : "te", hd ? "O" : "g");
        Field active = hd ? field("tf", "w") : null;
        Field immediate = hd ? field("sa", "W") : null;
        Method move = entity.getDeclaredMethod("a", int.class, int.class, hd ? int.class : byte.class, int.class, boolean.class);
        move.setAccessible(true);
        Field pathX = field(entity.getName(), hd ? "K" : "L");
        Field pathZ = field(entity.getName(), hd ? "w" : "ac");
        Field worldX = field(entity.getName(), hd ? "Qb" : "Z");
        Field worldZ = field(entity.getName(), hd ? "ac" : "S");
        Field pathLength = field(entity.getName(), hd ? "Nb" : "F");
        var in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] fields = line.split(" ");
            Object actor = player.newInstance();
            local.set(null, fields[1].equals("1") ? actor : player.newInstance());
            boolean before = fields[2].equals("1");
            if (hd) {
                active.setBoolean(null, fields[0].equals("1"));
                immediate.setBoolean(null, before);
            }
            ((int[]) pathX.get(actor))[0] = 40;
            ((int[]) pathZ.get(actor))[0] = 70;
            int x = Integer.parseInt(fields[4]), z = Integer.parseInt(fields[5]);
            boolean jump = fields[3].equals("1");
            if (hd) move.invoke(actor, -2, 2, x, z, jump);
            else move.invoke(actor, 2, z, (byte) 88, x, jump);
            System.out.println(pathLength.getInt(actor) + " " + ((int[]) pathX.get(actor))[0] + " " +
                ((int[]) pathZ.get(actor))[0] + " " + worldX.getInt(actor) + " " + worldZ.getInt(actor) + " " +
                (hd ? immediate.getBoolean(null) : before));
        }
    }

    private static Field field(String owner, String name) throws ReflectiveOperationException {
        Field result = Class.forName(owner).getDeclaredField(name);
        result.setAccessible(true);
        return result;
    }
}
