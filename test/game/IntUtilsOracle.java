class IntUtilsOracle {
    public static void main(String[] args) {
        int[] values={0,1,2,3,4,7,8,15,16,31,32,255,256,512,65535,65536,0x55555555,0xaaaaaaaa,
            Integer.MAX_VALUE,Integer.MIN_VALUE,-1,-2,-7,-31,-255,-65536};
        for(int n:values)for(int divisor:values) {
            id s=new id();s.c=n;
            String remainder;
            try{remainder=Integer.toString(m.a((byte)108,n,divisor));}catch(RuntimeException e){remainder="error";}
            System.out.println(e.a(50,n)+"|"+ki.c(0,n)+"|"+remainder+"|"+lh.a(18241,s));
        }
        for(int c=-2;c<=258;c++) {
            try{id s=nl.b(c,(byte)120);System.out.println(s.c+"|"+(s.A[0]&255));}catch(RuntimeException e){System.out.println("error");}
        }
    }
}
