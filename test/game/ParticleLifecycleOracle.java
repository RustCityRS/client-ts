import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.*;

// The child executes the unmodified gamepack. JDI constructor-exit observations
// expose the discarded allocations while their initialized receivers are still live.
public class ParticleLifecycleOracle {
    static int[][] vectors() {return new int[][]{gh.B,nf.n,tj.d,cf.o,lj.i,ii.e};}
    static void simulate() throws Exception {
        var detail=ue.class.getDeclaredField("p");
        if(detail.getType()!=int.class || !Modifier.isPrivate(detail.getModifiers()) || !Modifier.isStatic(detail.getModifiers()))
            throw new AssertionError("ue.p:I");
        for(Class<?> type:List.of(ue.class,n.class,ii.class))
            if(Arrays.stream(type.getDeclaredFields()).anyMatch(field->!Modifier.isStatic(field.getModifiers())))
                throw new AssertionError("unexpected instance state "+type);
        if(ue.class.getSuperclass()!=ii.class || n.class.getSuperclass()!=Object.class || ii.class.getSuperclass()!=Object.class)
            throw new AssertionError("class hierarchy");
        int[][] initial=vectors();
        System.out.println("initial "+Arrays.deepToString(initial));
        for(int i=0;i<6;i++)initial[i][1]=74546+i;
        System.out.println("default "+ue.a());
        new ii();
        new n();
        ue first=new ue(),second=new ue();
        for(int value:new int[]{Integer.MIN_VALUE,-1,0,1,2,3,17001,Integer.MAX_VALUE}) {
            ue.c(value);first.b();second.b();
            System.out.println("reset "+ue.a()+" "+(first!=second));
        }
        int[][] after=vectors();
        boolean same=true,distinct=true;
        for(int i=0;i<6;i++) {
            same &= initial[i]==after[i];
            for(int j=0;j<i;j++)distinct &= after[i]!=after[j];
        }
        System.out.println("arrays "+same+" "+distinct+" "+Arrays.deepToString(after));
    }
    static Value field(ObjectReference instance,String name){
        return instance.getValue(instance.referenceType().fieldByName(name));
    }
    static final Map<Long,Integer> ids=new HashMap<>();
    static int id(ObjectReference o){return ids.computeIfAbsent(o.uniqueID(),v->ids.size()+1);}
    static void observe(VirtualMachine vm,MethodExitEvent e,List<String> trace)throws Exception {
        String method=e.method().name(),owner=e.method().declaringType().name();
        if(!method.equals("<init>") && !(owner.equals("ue")&&method.equals("b")))return;
        List<StackFrame> frames=e.thread().frames(0,2);
        Location parent=frames.get(1).location();
        String caller=parent.declaringType().name()+"."+parent.method().name();
        if(!Set.of("ParticleLifecycleOracle.simulate","n.<init>","ue.<init>","ue.<clinit>").contains(caller))return;
        ObjectReference object=frames.get(0).thisObject();
        if(owner.equals("q")||owner.equals("gd")){
            if(!caller.equals("ue.<clinit>"))return;
            ReferenceType ueType=vm.classesByName("ue").get(0);
            Value detail=ueType.getValue(ueType.fieldByName("p"));
            if(owner.equals("q")){
                ArrayReference buckets=(ArrayReference)field(object,"h");
                Set<Long> distinct=new HashSet<>();boolean linked=true;
                for(Value value:buckets.getValues()){
                    ObjectReference node=(ObjectReference)value;distinct.add(node.uniqueID());
                    linked &= node.equals(field(node,"t")) && node.equals(field(node,"z"));
                }
                trace.add("q "+detail+" "+buckets.length()+" "+distinct.size()+" "+linked);
            }else{
                ArrayReference data=(ArrayReference)field(object,"fb");
                boolean clear=data.getValues().stream().allMatch(v->((ByteValue)v).value()==0);
                trace.add("gd "+detail+" "+field(object,"yb")+" "+data.length()+" "+clear);
            }
        }else if(owner.equals("gk")){
            ObjectReference sentinel=(ObjectReference)field(object,"c");
            trace.add("gk "+id(object)+" "+(sentinel.equals(field(sentinel,"g"))&&sentinel.equals(field(sentinel,"p"))&&field(object,"t")==null));
        }else{
            trace.add(owner+(method.equals("b")?".b":"")+" "+id(object)+" "+object.referenceType().name());
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length==0){simulate();return;}
        LaunchingConnector connector=Bootstrap.virtualMachineManager().defaultConnector();
        Map<String,Connector.Argument> options=connector.defaultArguments();
        options.get("main").setValue("ParticleLifecycleOracle");
        options.get("options").setValue("-cp \""+System.getProperty("java.class.path")+"\"");
        VirtualMachine vm=connector.launch(options);
        for(String name:List.of("ue","ii","n","q","gd","gk")){
            MethodExitRequest request=vm.eventRequestManager().createMethodExitRequest();
            request.addClassFilter(name);request.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);request.enable();
        }
        List<String> trace=new ArrayList<>();
        boolean running=true;
        while(running){
            EventSet events=vm.eventQueue().remove(15000);
            if(events==null){vm.dispose();throw new AssertionError("JDI timeout");}
            for(Event event:events){
                if(event instanceof MethodExitEvent exit)observe(vm,exit,trace);
                if(event instanceof VMDisconnectEvent || event instanceof VMDeathEvent)running=false;
            }
            events.resume();
        }
        var process=vm.process();int status=process.waitFor();
        if(status!=0)throw new AssertionError(new String(process.getErrorStream().readAllBytes(),StandardCharsets.UTF_8));
        System.out.print(new String(process.getInputStream().readAllBytes(),StandardCharsets.UTF_8));
        System.out.println("trace "+String.join(";",trace));
    }
}
