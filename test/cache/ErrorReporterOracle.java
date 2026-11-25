import java.lang.reflect.Method;

class ErrorReporterOracle {
    public static void main(String[] args) throws Exception {
        Throwable error = new IllegalStateException("bad:@&#%0a");
        error.setStackTrace(new StackTraceElement[]{
            new StackTraceElement("Cache","write","Cache.java",123),
            new StackTraceElement("Thread","run",null,-1)
        });
        Class<?> signature[] = {Throwable.class,String.class,int.class};
        Method report = Class.forName("pk").getDeclaredMethod("a",signature);
        report.setAccessible(true);
        report.invoke(null,error,"queue%0a9",1);
        report.invoke(null,null,(String)null,1);
        report.invoke(null,null,"disk",1);
    }
}
