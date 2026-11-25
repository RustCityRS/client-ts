import { expect, spyOn } from 'bun:test';
import Client from '#/client/Client.js';
import HintArrow from '#/client/HintArrow.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Pix2D from '#/graphics/Pix2D.js';
import Preferences from '#/ui/Preferences.js';
import Js5 from '#/cache/Js5.js';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import IdkType from '#/config/IdkType.js';
import NpcType from '#/config/NpcType.js';
import ClientEntity from '#/dash3d/ClientEntity.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath } from '../render/hd-reference.js';

type Identity = 'sd' | 'gl';

function javaReads(jar: string, identity: Identity, signature: string, simpleAngle?: number): string[] {
    const owner = signature.slice(0, signature.indexOf('.'));
    const descriptor = signature.slice(signature.indexOf('('));
    const javap = Bun.spawnSync(['javap', '-c', '-s', '-p', '-classpath', jar, owner]);
    expect(javap.exitCode, javap.stderr.toString()).toBe(0);
    const method = javap.stdout
        .toString()
        .replaceAll('\r', '')
        .split(/\n {2}(?=\S)/)
        .find(block => block.includes('descriptor: ' + descriptor + '\n'));
    if (!method) throw new Error(signature);
    const ops = [...method.matchAll(/^\s*\d+:\s+(\S+)[ \t]*([^\r\n]*)/gm)].map(m => [m[1], m[2].trim()]);
    const names = identity === 'gl' ? ['hf.g', 'hf.r'] : ['dc.l', 'dc.g'];
    const result: string[] = [];
    const slots = new Map<string, number>();
    for (let i = 0; i < ops.length; i++) {
        const [op, arg] = ops[i];
        if (simpleAngle === undefined && op === 'aaload' && ops[i + 1][0].startsWith('iconst_') && ops[i + 2][0] === 'iaload' && ops[i + 3][0] === 'istore') {
            const index = +ops[i + 1][0].slice(7);
            slots.set(ops[i + 3][1], index);
            result.push('bas' + index);
        }
        if (op !== 'getstatic') continue;
        const table = names.findIndex(name => arg.endsWith('Field ' + name + ':[I'));
        if (table < 0) continue;
        const index = simpleAngle ?? slots.get(ops[i + 1][1]);
        if (index === undefined) throw new Error(signature + ' angle source ' + ops[i + 1]);
        result.push((table === 0 ? 'sin' : 'cos') + index);
        if (result.filter(entry => !entry.startsWith('bas')).length === (simpleAngle === undefined ? 6 : 2)) return result;
    }
    throw new Error(signature + ' missing table operands');
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' actor transforms access BAS and trig operands in gamepack order',
        async () => {
            const gl = identity === 'gl';
            const jar = gl ? hdGamepackPath : gamepackPath;
            const mesh = new ModelUnlit(1, 0, 0);
            const bas = new BASType();
            BASTypeList.types.Put(1n, bas);
            const kit = new IdkType();
            spyOn(IdkType, 'List').mockReturnValue(kit);
            spyOn(kit, 'GetModelNoCheck').mockReturnValue(mesh);
            const archive = new Js5(null, false, false);
            spyOn(archive, 'RequestDownload').mockReturnValue(true);
            NpcType.m_pModels = archive;
            spyOn(ModelUnlit, 'Load').mockReturnValue(mesh);

            const inputs = new Int32Array(12);
            inputs[0] = -2147483648;
            const player = new PlayerModel();
            player.setAppearance(false, new Int32Array(5), 1, inputs, -1);
            const npc = new NpcType();
            npc.m_bodyList = Int32Array.of(1);
            npc.m_baseAnimationSet = 1;
            const hill = new ClientNpc();
            bas.hillX = bas.m_hillRotateLength = 4;
            spyOn(hill, 'getBasType').mockReturnValue(bas);

            function compare(signature: string, run: () => void, angle?: number): void {
                const expected = javaReads(jar, identity, signature, angle);
                const stop = new Error('last observed read');
                const actual: string[] = [];
                function observe(table: string, values: Int32Array): Int32Array {
                    return new Proxy(values, {
                        get(target, property) {
                            if (typeof property === 'string' && /^\d+$/.test(property)) {
                                actual.push(table + property);
                                if (actual.length === expected.length) throw stop;
                            }
                            return Reflect.get(target, property, target);
                        }
                    });
                }
                bas.transforms = [observe('bas', Int32Array.of(0, 1, 2, 3, 4, 5))];
                Pix3D.sinTable = observe('sin', new Int32Array(8));
                Pix3D.cosTable = observe('cos', new Int32Array(8));
                expect(run).toThrow(stop);
                expect(actual).toEqual(expected);
            }

            compare(gl ? 'dc.a(IZLtk;IIIIILak;IIIIB)Lak;' : 'kc.a(IILnd;IIZILek;IZIIII)Lnd;', () => ClientEntity.getShadowModel(0, 1, null, 0, 0, 0, null, 0, false, 0, 0, 0, 0), 0);
            compare(gl ? 'fe.a(BLak;I)V' : 'ob.a(ILnd;Z)V', () => hill.CalculateHillRotateTransform(3, new ModelLitImpl()), 3);
            compare(gl ? 'hh.a([Lub;ILtk;Ltk;IIIIZII)Lak;' : 'cl.a(IILek;IZ[Lci;IIZLek;I)Lnd;', () => player.GetTempModel(0, 0, null, 0, true, null, 0, 0, true, null, 0));
            compare(gl ? 'me.a([Lub;IBIIIILtk;ILtk;)Lak;' : 'ja.a([Lci;ILek;IIIBIILek;)Lnd;', () => npc.GetTempModel(null, 0, null, 0, 0, 0, 0, 0, null));

            // na.a @227..240, jb.a @206..225: retain framebuffer state in native order.
            const stop = new Error('final operand read');
            let fields: string[] = [];
            function watch(target: object, name: string, label: string, last: number): void {
                const value: unknown = Reflect.get(target, name);
                Object.defineProperty(target, name, {
                    configurable: true,
                    get() {
                        fields.push(label);
                        if (fields.length === last) throw stop;
                        return value;
                    }
                });
            }
            const type = new ObjType();
            spyOn(ObjType, 'List').mockReturnValue(type);
            spyOn(type, 'GetModelUnlitLit').mockReturnValue(new ModelLitImpl());
            for (const field of ['pixels', 'width', 'height']) watch(Pix2D, field, field, 3);
            expect(() => ObjType.buildSprite(0, 1, false, 0, false, 0)).toThrow(stop);
            expect(fields).toEqual(gl ? ['pixels', 'width', 'height'] : ['width', 'pixels', 'height']);

            // Type 2 in e.a @681..722 and pb.a @567..611 evaluates the two target coordinates in opposite order.
            fields = [];
            const actor = new ClientPlayer();
            actor.appearance = new PlayerModel();
            spyOn(actor.appearance, 'GetTempModel').mockReturnValue(new ModelLitImpl());
            Preferences.characterShadows = false;
            const hint = new HintArrow();
            hint.type = 2;
            hint.model = 0;
            Client.hintArrows.fill(null);
            Client.hintArrows[0] = hint;
            Client.localPlayer = actor;
            watch(Client, 'mapBuildBaseX', 'baseX', 6);
            watch(Client, 'mapBuildBaseZ', 'baseZ', 6);
            for (const axis of ['x', 'z']) {
                watch(actor, axis, 'actor.' + axis, 6);
                watch(hint, axis, 'hint.' + axis, 6);
            }
            expect(() => actor.draw(0, 0, 0, 0, 0, 0, 0, 0, 0n, 0, null)).toThrow(stop);
            expect(fields).toEqual(gl ? ['baseX', 'hint.x', 'actor.x', 'hint.z', 'baseZ', 'actor.z'] : ['actor.z', 'baseZ', 'hint.z', 'actor.x', 'baseX', 'hint.x']);
        },
        60000,
        identity
    );
}
