import java.util.Base64;
import java.nio.charset.StandardCharsets;

class WrappedExceptionOracle {
    public static void main(String[] args) {
        for(String source:new String[]{"Client.java","Client.kt",null})for(int line:new int[]{123,-1,-2})
        for(String first:new String[]{null,"a",""})for(String next:new String[]{null,"b",""})for(int mode=0;mode<3;mode++){
            var original=new IllegalStateException("oops");
            original.setStackTrace(new StackTraceElement[]{new StackTraceElement("client","run",source,line),
                new StackTraceElement("ca","run","ca.java",17)});
            Throwable value=mode==2?null:original;
            g wrapped=od.a(value,first),same=wrapped;
            if(mode!=0)same=od.a(wrapped,next);
            String trace;
            try {trace=uc.a((byte)7,same);}catch(Exception ex){trace="<exception>";}
            System.out.println((same==wrapped)+"|"+(same.a==value)+"|"+same.q+"|"+
                Base64.getEncoder().encodeToString(trace.getBytes(StandardCharsets.UTF_8)));
        }
    }
}
