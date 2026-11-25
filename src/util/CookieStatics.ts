import GameShell from '#/client/GameShell';
import JagString, { fromLiteral, type JagStringApplet } from '#/datastruct/JagString';
import Client from '#/client/Client';
import SafeTime from '#/io/SafeTime';
import { arrayAtObj, requireNonNull } from './JavaArray';
import JavaCalendar from './JavaCalendar';

// gi
export default class CookieStatics {
    static readonly cookiePrefixParam = fromLiteral('cookieprefix'); // fi.g:Lid;
    static readonly cookiePrefix = fromLiteral('document)3cookie=(R'); // dk.V:Lid;
    static readonly cookieSuffix = fromLiteral('(R'); // df.A:Lid;
    static readonly paramCookieHost = fromLiteral('cookiehost'); // ac.o:Lid;
    static readonly settingsCookieKey = fromLiteral('settings='); // lg.N:Lid;
    static readonly cookiePathDomain = fromLiteral('; version=1; path=)4; domain='); // h.d:Lid;
    static readonly expiresAttribute = fromLiteral('; Expires='); // cf.i:Lid;
    static readonly maxAgeAttribute = fromLiteral('; Max)2Age='); // kc.r:Lid;
    static readonly expiredCookieSuffix = fromLiteral('; Expires=Thu)1 01)2Jan)21970 00:00:00 GMT; Max)2Age=0'); // n.b:Lid;
    static readonly dateDaySeparator = fromLiteral(')1 '); // ek.d:Lid;
    static readonly dateDash = fromLiteral(')2'); // g.l:Lid;
    static readonly timeSeparator = fromLiteral(':'); // mc.M:Lid;
    static readonly gmtSuffix = fromLiteral(' GMT'); // kk.X:Lid;
    static readonly sun = fromLiteral('Sun'); // rj.n:Lid;
    static readonly mon = fromLiteral('Mon'); // rj.y:Lid;
    static readonly tue = fromLiteral('Tue'); // rj.w:Lid;
    static readonly wed = fromLiteral('Wed'); // rj.f:Lid;
    static readonly thu = fromLiteral('Thu'); // rj.c:Lid;
    static readonly fri = fromLiteral('Fri'); // rj.u:Lid;
    static readonly sat = fromLiteral('Sat'); // rj.g:Lid;
    static dayNames: (JagString | null)[] | null = [this.sun, this.mon, this.tue, this.wed, this.thu, this.fri, this.sat]; // rj.k:[Lid;
    static readonly jan = fromLiteral('Jan'); // p.z:Lid;
    static readonly feb = fromLiteral('Feb'); // p.H:Lid;
    static readonly mar = fromLiteral('Mar'); // p.w:Lid;
    static readonly apr = fromLiteral('Apr'); // p.q:Lid;
    static readonly may = fromLiteral('May'); // p.D:Lid;
    static readonly jun = fromLiteral('Jun'); // p.a:Lid;
    static readonly jul = fromLiteral('Jul'); // p.K:Lid;
    static readonly aug = fromLiteral('Aug'); // p.j:Lid;
    static readonly sep = fromLiteral('Sep'); // p.X:Lid;
    static readonly oct = fromLiteral('Oct'); // p.P:Lid;
    static readonly nov = fromLiteral('Nov'); // p.y:Lid;
    static readonly dec = fromLiteral('Dec'); // p.R:Lid;
    static monthNames: (JagString | null)[] | null = [this.jan, this.feb, this.mar, this.apr, this.may, this.jun, this.jul, this.aug, this.sep, this.oct, this.nov, this.dec]; // p.c:[Lid;
    static readonly space = fromLiteral(' '); // pk.f:Lid;
    static gmtCalendar: JavaCalendar | null = new JavaCalendar('GMT'); // hc.b:Ljava/util/Calendar;

    // gk.a(IJ)Lid;. gi.a passes 0 for the first argument.
    static formatCookieDate(time: bigint): JagString {
        requireNonNull(CookieStatics.gmtCalendar).setTimeInMillis(time);
        const weekday = requireNonNull(CookieStatics.gmtCalendar).get(7);
        const day = requireNonNull(CookieStatics.gmtCalendar).get(5);
        const month = requireNonNull(CookieStatics.gmtCalendar).get(2);
        const year = requireNonNull(CookieStatics.gmtCalendar).get(1);
        const hour = requireNonNull(CookieStatics.gmtCalendar).get(11);
        const minute = requireNonNull(CookieStatics.gmtCalendar).get(12);
        const second = requireNonNull(CookieStatics.gmtCalendar).get(13);
        return JagString.join([
            arrayAtObj(CookieStatics.dayNames, (weekday - 1) | 0),
            CookieStatics.dateDaySeparator,
            JagString.fromInt((day / 10) | 0),
            JagString.fromInt(day % 10),
            CookieStatics.dateDash,
            arrayAtObj(CookieStatics.monthNames, month),
            CookieStatics.dateDash,
            JagString.fromInt(year),
            CookieStatics.space,
            JagString.fromInt((hour / 10) | 0),
            JagString.fromInt(hour % 10),
            CookieStatics.timeSeparator,
            JagString.fromInt((minute / 10) | 0),
            JagString.fromInt(minute % 10),
            CookieStatics.timeSeparator,
            JagString.fromInt((second / 10) | 0),
            JagString.fromInt(second % 10),
            CookieStatics.gmtSuffix
        ]);
    }

    // gi.a(ZLid;)V
    static setCookie(settings: JagString | null): void {
        Client.settings = settings;
        if (requireNonNull(GameShell.signlink).applet === null) return;
        try {
            const prefix = this.cookiePrefixParam.getParameter(requireNonNull(requireNonNull(GameShell.signlink).applet) as Pick<JagStringApplet, 'getParameter'>);
            const domain = this.paramCookieHost.getParameter(requireNonNull(requireNonNull(GameShell.signlink).applet) as Pick<JagStringApplet, 'getParameter'>);
            let cookie = JagString.join([prefix, this.settingsCookieKey, settings, this.cookiePathDomain, domain]);
            if (requireNonNull(settings).getLength() === 0) cookie = JagString.join([cookie, this.expiredCookieSuffix]);
            else cookie = JagString.join([cookie, this.expiresAttribute, this.formatCookieDate(BigInt.asIntN(64, 94608000000n + SafeTime.CurrentTimeMillis())), this.maxAgeAttribute, JagString.fromLong(94608000n)]);
            const script = JagString.join([this.cookiePrefix, cookie, this.cookieSuffix]);
            script.evaluateScript(requireNonNull(GameShell.signlink).applet as Pick<JagStringApplet, 'evaluate'> | null);
        } catch {
            // The original client ignores failures from this host operation.
        }
    }
}
