import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.Arrays;

public class MessageBoxOracle {
    public static void main(String[] args) throws Exception {
        final int w=281,h=127;
        BufferedImage surface=new BufferedImage(w,h,BufferedImage.TYPE_INT_ARGB);
        pe.S=new Canvas(){public Graphics getGraphics(){return surface.getGraphics();}};
        rg.s=bj.a(-62,h,pe.S,w);
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)5);metrics[256]=8;
        int[] zero=new int[256],width=new int[256],height=new int[256];
        Arrays.fill(width,3);Arrays.fill(height,5);
        byte[][] mask=new byte[256][15];
        for(int c=0;c<256;c++)for(int j=0;j<15;j++)if((c+j)%3!=0)mask[c][j]=1;
        wj.g=new fg(metrics,zero,zero,width,height,mask);
        String[] texts={"Please wait","This line is deliberately long enough to wrap more than once when drawn in the original black message box.",
            "first<br>second","<col=ff00ff>text</col>-<lt>","",null};
        for(int step=0;step<64;step++){
            ik.G=(step*13)%101;
            for(int i=0;i<100;i++){
                nh.Y[i]=(37*i+step)%311-20;r.U[i]=(9*i-step)%170-7;gk.i[i]=(91*i)%90;ik.Q[i]=(37*i)%41;
                sf.m[i]=i%13==0;ce.T[i]=i%7==0;
            }
            Arrays.fill(rg.s.n,0x112233);
            Graphics clear=surface.getGraphics();clear.setColor(new Color(0x445566));clear.fillRect(0,0,w,h);clear.dispose();
            String s=texts[step%texts.length];id msg=s==null?null:vb.a(s,(byte)99);
            vg.a(msg,(step&1)!=0,(byte)-100);
            System.out.println(Arrays.hashCode(rg.s.n)+" "+Arrays.hashCode(surface.getRGB(0,0,w,h,null,0,w))+" "+Arrays.hashCode(sf.m)+" "+Arrays.hashCode(ce.T));
        }
        client applet=WindowModeOracle.container(client.class);
        aj.kb=WindowModeOracle.container(WindowModeOracle.TestFrame.class);
        hi.f=vk.rb=w; fl.l=oh.j=h; pa.rb=sk.N=0;
        qf.f=we.y=false;
        int[] amounts={0,-2147483648,6,50,2147483647,1073741824};
        int[] maxima={0,1,17,37,2147483647,1073741900};
        for(int language=0;language<3;language++){
            ii.a((byte)126,language);
            for(int state:new int[]{25,28,40,20,1000})for(int stage=0;stage<4;stage++)for(int k=0;k<amounts.length;k++){
                tf.C=state; bc.e=stage; ah.d=amounts[k]; th.d=maxima[k]; pd.r=amounts[k]; mf.p=maxima[k];
                hi.g=(k&1)==0; ik.G=34; Arrays.fill(ce.T,true); Arrays.fill(sf.m,false);
                Arrays.fill(rg.s.n,0x112233);
                Graphics clear=surface.getGraphics();clear.setColor(new Color(0x445566));clear.fillRect(0,0,w,h);clear.dispose();
                boolean error=false;
                try{applet.d(0);}catch(RuntimeException ex){error=true;}
                System.out.println(error+" "+Arrays.hashCode(rg.s.n)+" "+Arrays.hashCode(surface.getRGB(0,0,w,h,null,0,w))+
                    " "+Arrays.hashCode(sf.m)+" "+Arrays.hashCode(ce.T)+" "+th.d+" "+mf.p+" "+hi.g);
            }
        }
    }
}
