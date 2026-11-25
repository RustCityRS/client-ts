// dj
export default class SignlinkRequest<T = unknown> {
    // dj.a:Ljava/lang/Object;
    result: T | null = null;
    // dj.b:I
    status = 0;
    // dj.c:I
    intArg = 0;
    // dj.d:Ljava/lang/Object;
    objectArg: unknown = null;
    // dj.e:I
    type = 0;
    // dj.f:Ldj;
    next: SignlinkRequest | null = null;
    // dj.<init>()V
    constructor() {}
}
