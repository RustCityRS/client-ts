import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public class ScriptCalendarOrderOracle {
    static Calendar first, other;
    static final long start=1609559893781L,alternate=637597507639L,now=1931010265013L;
    static StringJoiner trace;
    static int ordinal,change,mode;
    static Calendar calendar(Calendar captured){
        trace.add(captured==null?"null":captured==first?"A":"B");
        if(++ordinal==change)switch(mode){
            case 1 -> ok.s=other;
            case 2 -> ok.s=null;
            case 3 -> throw new IllegalStateException("calendar probe");
            case 4 -> captured.setTimeInMillis(alternate);
            case 5 -> tg.B=new int[]{-20,-21,-22,-23};
            case 6 -> g.p=null;
        }
        return captured;
    }
    static long clock(int unused){trace.add("now");return now;}
    static void instrument(Path dir)throws Exception{
        try(var bytes=ScriptCalendarOrderOracle.class.getResourceAsStream("/gh.class")){
            ClassReader reader=new ClassReader(bytes);ClassWriter out=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e){
                    MethodVisitor mv=super.visitMethod(a,n,d,s,e);
                    if(!n.equals("a")||!d.equals("(Lwf;II)V"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitFieldInsn(int op,String owner,String name,String desc){
                            super.visitFieldInsn(op,owner,name,desc);
                            if(op==Opcodes.GETSTATIC&&owner.equals("ok")&&name.equals("s"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ScriptCalendarOrderOracle","calendar",
                                    "(Ljava/util/Calendar;)Ljava/util/Calendar;",false);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface){
                            if(owner.equals("eh")&&name.equals("a")&&desc.equals("(I)J"))
                                super.visitMethodInsn(op,"ScriptCalendarOrderOracle","clock",desc,false);
                            else super.visitMethodInsn(op,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("gh.class"),out.toByteArray());
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){instrument(Path.of(args[0]));return;}
        PrintStream output=System.out;
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            String[] p=line.split(" ");int op=Integer.parseInt(p[0]),count=Integer.parseInt(p[1]);
            change=Integer.parseInt(p[2]);mode=Integer.parseInt(p[3]);ordinal=0;trace=new StringJoiner(",");
            first=Calendar.getInstance(TimeZone.getTimeZone(p[4]));other=Calendar.getInstance(TimeZone.getTimeZone(p[4]));
            first.setTimeInMillis(start);other.setTimeInMillis(alternate);ok.s=first;
            int[] stack={51,52,53,54};tg.B=stack;id[] strings=new id[1];g.p=strings;
            m script=new m();script.D=new int[count+2];script.F=new int[count+2];script.B=new id[count+2];
            for(int i=0;i<count;i++)script.F[i]=Integer.parseInt(p[5+i]);
            script.D[count]=op;script.D[count+1]=21;
            sf.g=new vj(8);sf.g.a(77L,0,script);
            wf event=new wf();event.G=new Object[]{77};
            ByteArrayOutputStream report=new ByteArrayOutputStream();System.setOut(new PrintStream(report));
            try{gh.a(event,-22368,100);}finally{System.setOut(output);}
            String message=report.toString(),fault=message.isEmpty()?"ok":message.contains("calendar probe")?"stop":
                message.contains("NullPointerException")?"null":message.contains("IndexOutOfBoundsException")?"bounds":"other";
            output.println(String.join("/",fault,trace.toString(),Arrays.toString(stack),Arrays.toString(tg.B),
                strings[0]==null?"~":HexFormat.of().formatHex(strings[0].A,0,strings[0].c),
                ""+first.getTimeInMillis(),""+other.getTimeInMillis(),ok.s==null?"null":ok.s==first?"A":"B"));
        }
    }
}
