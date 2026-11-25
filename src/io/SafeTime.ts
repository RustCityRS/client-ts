export default class SafeTime {
    // eh.a:J
    private static m_lastTime = 0n;
    // eh.b:J
    private static m_offset = 0n;

    // eh.<init>()V
    private constructor() {}

    // eh.a(I)J
    static CurrentTimeMillis(): bigint {
        const current = BigInt(Date.now());
        if (SafeTime.m_lastTime > current) SafeTime.m_offset = BigInt.asIntN(64, SafeTime.m_offset - current + SafeTime.m_lastTime);
        SafeTime.m_lastTime = current;
        return BigInt.asIntN(64, current + SafeTime.m_offset);
    }
}
