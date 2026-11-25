import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HexFormat;

public final class InventoryNumberOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] columns = line.split(" ");
            int language = Integer.parseInt(columns[0]);
            int count = Integer.parseInt(columns[1]);
            ii.a((byte)127, language);
            id widget = gf.c(count, 127);
            id icon = ii.a(92, count);
            System.out.println(HexFormat.of().formatHex(widget.b(false)) + " " + HexFormat.of().formatHex(icon.b(false)));
        }
    }
}
