import java.awt.Canvas;
import java.awt.event.*;
import java.io.*;
import java.util.Arrays;

class MouseOracle {
    static String state(MouseEvent event, Canvas canvas, int rotation) {
        return String.join(";", ""+r.P,""+ha.d,""+mg.S,""+ob.Ib,""+je.ab,""+bi.j,""+tk.g,""+pf.e(15),
            ""+ca.a,""+sj.C,""+pf.Q,""+oi.h,""+sa.x,""+oj.e,""+lc.v,""+event.isConsumed(),
            ""+(ai.g!=null),""+canvas.getMouseListeners().length,""+canvas.getMouseMotionListeners().length,
            ""+canvas.getFocusListeners().length,""+canvas.getMouseWheelListeners().length,""+rotation);
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas();
        uk mouse = ai.g;
        ih wheel = (ih)wg.a(-110);
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=input.readLine()) != null;) {
            String[] p = line.split(" ");
            HostClockFixture.millis=Long.parseLong(p[5]);
            int x = Integer.parseInt(p[1]), y = Integer.parseInt(p[2]);
            MouseEvent event = new MouseEvent(canvas,MouseEvent.MOUSE_PRESSED,0,p[3].equals("1")?InputEvent.META_DOWN_MASK:0,
                x,y,1,p[4].equals("1"));
            int rotation = 0;
            switch(p[0]) {
                case "start" -> { pg.a(0,canvas); wheel.a(false,canvas); }
                case "stop" -> { ke.a(canvas,0); wheel.a((byte)52,canvas); }
                case "enter" -> mouse.mouseEntered(event);
                case "exit" -> mouse.mouseExited(event);
                case "move" -> mouse.mouseMoved(event);
                case "drag" -> mouse.mouseDragged(event);
                case "press" -> mouse.mousePressed(event);
                case "release" -> mouse.mouseReleased(event);
                case "click" -> mouse.mouseClicked(event);
                case "focus" -> mouse.focusGained(null);
                case "blur" -> mouse.focusLost(null);
                case "poll" -> wk.a((byte)106);
                case "setIdle" -> tf.a(x,119);
                case "dispose" -> ej.d(0);
                case "wheel" -> wheel.mouseWheelMoved(new MouseWheelEvent(canvas,MouseEvent.MOUSE_WHEEL,0,0,x,y,0,false,
                    MouseWheelEvent.WHEEL_UNIT_SCROLL,1,x));
                case "wheelPoll" -> rotation=wheel.a((byte)-56);
                default -> throw new AssertionError(line);
            }
            System.out.println(state(event,canvas,rotation));
        }
        ag recorder = new ag();
        sj.C=-99; pf.Q=101;
        int[] step={0};
        HostClockFixture.afterSleep=()->{
            if (HostClockFixture.sleeps.size()%2!=0) return;
            System.out.println(recorder.n+";"+Arrays.hashCode(recorder.o)+";"+Arrays.hashCode(recorder.m)+";"+
                HostClockFixture.sleeps.get(HostClockFixture.sleeps.size()-2)+";"+HostClockFixture.sleeps.get(HostClockFixture.sleeps.size()-1));
            step[0]++;
            sj.C=step[0]*17-381; pf.Q=555-step[0]*21;
            if (step[0]==508) recorder.h=false;
        };
        recorder.run();
    }
}
