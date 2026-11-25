import java.io.*;
import java.util.*;
import java.util.regex.*;

/** Runs the original h.a(BILjl;)V interpreter on injected qc bytecode and real be widgets. */
public final class HdWidgetDepthScriptOracle {
    private static be widget(int slot) {
        be widget = new be();
        widget.Fc = 0x10000 + slot;
        widget.cb = 73;
        widget.Uc = slot;
        widget.Vc = (short)(110 + slot);
        widget.o = (short)(-110 - slot);
        return widget;
    }

    public static void main(String[] args) throws Exception {
        var input = new BufferedReader(new InputStreamReader(System.in));
        var console = System.out;
        var report = Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");
        int key = 110001;
        for (String line; (line = input.readLine()) != null;) {
            int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op = row[0], active = row[1], layout = row[2], size = row.length - 3;
            be[] widgets = {widget(0),widget(1),widget(2)};
            sg.i = widgets[0];
            wf.j = widgets[1];
            th.j = new be[][]{null,widgets.clone()};
            sc.m = new boolean[]{false,true};
            oj.v = 73;
            pa.R = new boolean[100];
            // Layout changes all targets alike. An incorrect receiver remains visible in the field pairs.
            if (layout == 1) {
                sg.i = wf.j = null;
                th.j[1][2] = null;
            }
            for (be widget : widgets) {
                if (layout == 2) widget.cb = 72;
                if (layout >= 3) widget.Uc = 100;
                if (layout == 4) widget.cb = 72;
            }
            Arrays.fill(uj.t,-444);
            qc code = new qc();
            code.W = new int[size + 3];
            code.O = new int[size + 3];
            code.T = new na[size + 3];
            System.arraycopy(row,3,code.W,0,size);
            code.O[size] = op; code.W[size] = active;
            code.W[size + 1] = -4444444; code.O[size + 2] = 21;
            ib.d.a(code,key,(byte)-87);
            jl event = new jl(); event.E = new Object[]{key++};
            var log = new ByteArrayOutputStream();
            System.setOut(new PrintStream(log));
            try { h.a((byte)-12,100,event); } finally { System.setOut(console); }
            String message = log.toString();
            var match = report.matcher(message);
            String fault = "-";
            if (match.find()) fault = match.group(1) + "/" + (message.contains("NullPointerException") ? "null" :
                message.contains("IndexOutOfBoundsException") ? "bounds" : "other");
            var pairs = new StringJoiner(",");
            for (be widget : widgets) pairs.add(widget.Vc + ":" + widget.o);
            console.println(fault + "|" + pairs + "|" + pa.R[0] + "," + pa.R[1] + "," + pa.R[2] + "|" +
                Arrays.hashCode(uj.t));
        }
    }
}
