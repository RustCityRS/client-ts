import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import GameShell from '#/client/GameShell';
import { fromLiteral, type JagStringApplet } from '#/datastruct/JagString';
import { requireNonNull } from './JavaArray';
import { intDivide } from './IntUtils';

export default class BrowserControl {
    static readonly tbrefresh = fromLiteral('tbrefresh'); // ci.l:Lid;
    static readonly showVideoAd = fromLiteral('showVideoAd'); // og.g:Lid;
    static readonly jsShowingVideoAd = fromLiteral('showingVideoAd'); // qe.lb:Lid;

    // SD w.a(ILjava/applet/Applet;Ljava/lang/String;)Ljava/lang/Object;, HD gh.a(Ljava/lang/String;BLjava/applet/Applet;)Ljava/lang/Object;
    static call(guard: number, applet: Pick<JagStringApplet, 'call'> | null, name: string | null): unknown {
        if (glJar ? guard > -87 : guard !== -11594) return null;
        return requireNonNull(applet).call(name);
    }

    // HD gh.a(Ljava/applet/Applet;Ljava/lang/String;[Ljava/lang/Object;B)Ljava/lang/Object;
    static callWithArgs(applet: Pick<JagStringApplet, 'call'> | null, name: string | null, args: unknown[] | null, guard: number): unknown {
        intDivide(-90, intDivide(guard - 40, 55));
        return requireNonNull(applet).call(name, args);
    }

    // SD w.a(ILjava/lang/String;Ljava/applet/Applet;)V, HD gh.a(Ljava/applet/Applet;ZLjava/lang/String;)V
    static eval(guard: number, script: string | null, applet: Pick<JagStringApplet, 'evaluate'> | null): void {
        if (glJar || guard > 12) requireNonNull(applet).evaluate(script);
    }

    // pe.c(B)Z
    static showVideoAd2(): boolean {
        if (Client.javascript) {
            try {
                const applet = requireNonNull(GameShell.signlink).applet as Pick<JagStringApplet, 'call'> | null;
                this.showVideoAd.callScript(applet, glJar ? -1857 : 65);
                return true;
            } catch {
                // The original client ignores failures from this host operation.
            }
        }
        return false;
    }

    // d.b(B)Z
    static isVideoAdDone(): boolean {
        if (Client.javascript) {
            try {
                const applet = requireNonNull(GameShell.signlink).applet as Pick<JagStringApplet, 'call'> | null;
                return this.jsShowingVideoAd.callScript(applet, glJar ? -1857 : 8) !== true;
            } catch {
                // The original client ignores failures from this host operation.
            }
        }
        return true;
    }
}
