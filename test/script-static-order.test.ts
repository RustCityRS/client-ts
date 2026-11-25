import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import StockPlayerOffer from '#/client/StockPlayerOffer.js';
import SuperPacket from '#/io/SuperPacket.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import AccountCreation from '#/io/AccountCreation.js';
import WorldList from '#/io/WorldList.js';
import ChatHistory from '#/game/ChatHistory.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import WorldMap from '#/ui/WorldMap.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import GameShell from '#/client/GameShell.js';
import Preferences from '#/ui/Preferences.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import Signlink from '#/util/Signlink.js';
import Minimenu from '#/ui/Minimenu.js';
import EnumType from '#/config/EnumType.js';
import ParamType from '#/config/ParamType.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Js5 from '#/cache/Js5.js';
import MapArea from '#/ui/MapArea.js';
import PacketT from '#/io/PacketT.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import JagString, { fromJsString, toJsString } from '#/datastruct/JagString.js';
import FriendChatChannel from '#/client/FriendChatChannel.js';
import FriendChatUser from '#/client/FriendChatUser.js';
import Login from '#/io/Login.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

// Native SD and HD fields observed directly inside gh.a / h.a. The final entries
// name player instance fields used to give the coordinate path distinct operands.
const fields: [object, string, string, string, string][] = [
    [ScriptRunner, 'intStack', 'tg.B', 'uj.t', 'array'],
    [Client, 'loopCycle', 'hh.kb', 'gj.d', 'int'],
    [Client, 'statEffectiveLevel', 'di.i', 'hk.fb', 'array'],
    [Client, 'statBaseLevel', 'wa.o', 'lb.p', 'array'],
    [Client, 'statXP', 'll.m', 'sg.b', 'array'],
    [Client, 'playerLevel', 'ah.f', 'ee.b', 'int'],
    [Client, 'mapBuildBaseX', 'hk.e', 'se.a', 'int'],
    [Client, 'localPlayer', 'te.g', 'nk.O', 'object'],
    [Client, 'mapBuildBaseZ', 'vj.t', 'lc.n', 'int'],
    [Client, 'members', 'ka.c', 'aa.l', 'bool'],
    [Client, 'staffModLevel', 'mi.E', 'pg.S', 'int'],
    [Client, 'rebootTimer', 'wk.l', 'em.B', 'int'],
    [Client, 'selectedWorldId', 'qj.C', 'jl.H', 'int'],
    [Client, 'runenergy', 'ie.s', 'bb.E', 'int'],
    [Client, 'runWeight', 'uj.k', 'ug.o', 'int'],
    [Client, 'blackmarks', 'tg.r', 'ud.O', 'int'],
    [Client, 'playerMember', 'da.d', 'qg.W', 'bool'],
    [Client, 'underage', 'ld.g', 'jk.G', 'bool'],
    [Client, 'parentalChatConsent', 'd.h', 'ql.c', 'bool'],
    [Client, 'mapQuickChat', 'qi.Z', 'gm.bb', 'bool'],
    [Login, 'loginType', 'fk.cb', 'af.c', 'int'],
    [LocalisedText, 'language', 'hl.w', 'lb.v', 'int'],
    [Client, 'affiliateId', 'ce.F', 'qi.r', 'int'],
    [FriendChatChannel, 'channelName', 'dk.P', 'be.ac', 'object'],
    [FriendChatChannel, 'memberCount', 'uh.N', 'rg.y', 'int'],
    [Client, 'friendState', 'ei.u', 'nc.m', 'int'],
    [Client, 'ignoreCount', 'n.h', 'cl.Z', 'int'],
    [Client, 'localPlayer.x', 'te.g.Z', 'nk.O.Qb', 'int'],
    [Client, 'localPlayer.z', 'te.g.S', 'nk.O.ac', 'int'],
    [Client, 'localPlayer.combatLevel', 'te.g.uc', 'nk.O.yc', 'int'],
    [Client, 'localPlayer.appearance', 'te.g.pc', 'nk.O.Bc', 'object'],
    [Client, 'localPlayer.appearance.female', 'te.g.pc.m', 'nk.O.Bc.x', 'bool'],
    [ScriptRunner, 'stringStack', 'g.p', 'ab.j', 'strings'],
    [ScriptRunner, 'emptyString', 'uj.i', 'fl.Q', 'object'],
    [Client, 'friendCount', 'sj.L', 'al.m', 'int'],
    [Client, 'friendUsername', 'ck.p', 'jh.b', 'strings'],
    [Client, 'friendWorld', 'jf.b', 'ia.d', 'array'],
    [Client, 'friendRank', 'sf.e', 'ic.l', 'array'],
    [Client, 'friendWorldName', 'pa.qb', 'rg.r', 'strings'],
    [Client, 'friendSameGame', 'm.L', 'ab.c', 'flags'],
    [Client, 'ignoreName37', 'pi.r', 'pf.h', 'longs'],
    [FriendChatChannel, 'clanMembers', 'jl.b', 'qc.bb', 'objects'],
    [FriendChatChannel, 'ownerName', 'hg.g', 'wb.m', 'object'],
    [FriendChatChannel, 'minKick', 'mh.g', 'e.rc', 'int'],
    [FriendChatChannel, 'selfRank', 've.r', 'mj.u', 'int'],
    [Client, 'country', 'da.e', 'wk.w', 'int'],
    [Client, 'grandExchangeOffers', 'rb.h', 'si.X', 'offers'],
    [Client, 'chatPublicMode', 'si.e', 'ej.U', 'int'],
    [Client, 'chatPrivateMode', 'nk.gb', 'dm.m', 'int'],
    [Client, 'chatTradeMode', 'sd.V', 'gk.i', 'int'],
    [ChatHistory, 'count', 've.m', 'f.Z', 'int'],
    [ClientKeyboardListener, 'pressed', 'ob.q', 'pb.q', 'flags'],
    [Client, 'searchResults', 'qa.R', 'nf.c', 'shorts'],
    [Client, 'searchResultIndex', 'mc.y', 'fe.x', 'int'],
    [Client, 'resultCount', 'hc.k', 'ii.l', 'int'],
    [Client, 'gameState', 'tf.C', 'tl.d', 'int'],
    [Login, 'worldLookupStep', 'pe.P', 'rl.X', 'int'],
    [Client, 'loginStep', 'od.O', 'ol.V', 'int'],
    [AccountCreation, 'step', 't.L', 'oe.l', 'int'],
    [WorldList, 'fetchStep', 'wd.g', 'gi.c', 'int'],
    [Login, 'loginReply', 'dg.h', 'vk.b', 'int'],
    [Login, 'hopTime', 'il.K', 'sk.ib', 'int'],
    [AccountCreation, 'accountReply', 'nb.e', 'sc.y', 'int'],
    [Login, 'disallowResult', 'kl.X', 'qi.A', 'int'],
    [Login, 'suggestedNames', 'gj.X', 'si.S', 'strings'],
    [ScriptRunner, 'activeComponent', 'al.B', 'sg.i', 'widget'],
    [ScriptRunner, 'activeComponent2', 'ai.i', 'wf.j', 'widget'],
    [ScriptRunner, 'calendar', 'ok.s', 'hn.K', 'object'],
    [ScriptRunner, 'months', 'u.g', 'ck.f', 'strings'],
    [ScriptRunner, 'dateSeparator', 'li.p', 'n.e', 'object'],
    [ScriptRunner, 'crownTag0', 'q.f', 'fl.H', 'object'],
    [ScriptRunner, 'img1Tag', 'lj.a', 'hm.R', 'object'],
    [ScriptRunner, 'activeQuickChatMessage', 'bh.h', 'jh.n', 'object'],
    [ScriptRunner, 'quickChatPacketsSent', 'o.Q', 'hc.R', 'int'],
    [ScriptRunner, 'frameCount', 'oi.b', 'km.ad', 'int'],
    [ScriptRunner, 'intLocals', 'mk.J', 'rh.a', 'array'],
    [Client, 'modeWhere', 'd.c', 'gj.b', 'int'],
    [Client, 'localPlayer.username', 'te.g.Gc', 'nk.O.Mc', 'object'],
    [ScriptRunner, 'activeComponent.operationNames', 'al.B.Yc', 'sg.i.q', 'strings'],
    [ScriptRunner, 'activeComponent.opBaseValue', 'al.B.r', 'sg.i.Dc', 'object'],
    [WorldMap, 'lineBreak', 'bc.f', 'af.m', 'object'],
    [ScriptRunner, 'space', 'wh.Y', 'fe.I', 'object'],
    [Client, 'midiSong', 'dd.n', 's.c', 'int'],
    [Client, 'm_pMidi', 'al.l', 'kc.w', 'object'],
    [Preferences, 'musicVolume', 'sd.N', 'bb.n', 'int'],
    [GameShell, 'signlink', 'tj.m', 'fk.l', 'object'],
    [GameShell, 'canvasInvalid', 'wd.b', 'cl.bb', 'bool'],
    [Signlink, 'osNameLower', 'fb.l', 'll.n', 'raw'],
    [Client, 'haveIe6', 'vk.kb', 'od.n', 'bool'],
    [Client, 'urlNewWindow', 'pa.tb', 'na.W', 'bool'],
    [PlayerModel, 'maleKitBodyParts', 'ph.k', 'qi.x', 'array'],
    [PlayerModel, 'femaleBodyParts', 'kf.p', 'mc.ab', 'array'],
    [InterfaceList, 'subInterfaces', 'va.Z', 'je.T', 'object'],
    [WorldMap, 'baseX', 'oi.a', 'mh.S', 'int'],
    [WorldMap, 'baseZ', 'od.P', 'aa.j', 'int'],
    [WorldMap, 'height', 'ml.m', 'oi.m', 'int'],
    [WorldMap, 'centerX', 'c.C', 'bc.W', 'int'],
    [WorldMap, 'centerZ', 'sg.b', 'cd.u', 'int'],
    [Signlink, 'platform', 'fb.f', 'll.e', 'int'],
    [GameShell, 'maxMemory', 'te.e', 'te.C', 'int'],
    [RoofModeStatics, 'roofRemovalDisabled', 'kf.n', 'k.m', 'bool'],
    [Preferences, 'steppedCameraKeys', 'hc.a', 'cj.h', 'bool'],
    [Client, 'defaultCursor', 'ig.t', 'wb.c', 'int'],
    [Minimenu, 'objCursor', 'gl.C', 'nf.i', 'int'],
    [Minimenu, 'examineCursor', 'me.P', 'se.h', 'int'],
    [Minimenu, 'backgroundColour', 'lj.j', 'da.ab', 'int'],
    [Minimenu, 'transparency', 'd.p', 'ii.y', 'int'],
    [Minimenu, 'highlightColour', 'jh.m', 'ug.p', 'int'],
    [Minimenu, 'skinHoverAlpha', 'bc.i', 'sm.b', 'int'],
    [Minimenu, 'skinTitleSpriteId', 'bi.k', 'ee.c', 'int'],
    [Minimenu, 'skinTitleEndSprite', 'ah.e', 'nf.e', 'int'],
    [Minimenu, 'bottomSpriteId', 'fd.ab', 'gl.d', 'int'],
    [Minimenu, 'sideSpriteId', 'nh.O', 'kk.i', 'int'],
    [Minimenu, 'skinBottomCornerSprite', 'bd.W', 'uj.E', 'int'],
    [Minimenu, 'textColour', 'qi.U', 'pk.Y', 'int'],
    [Minimenu, 'skinHighlightTextColour', 'bj.h', 'vf.c', 'int'],
    [Minimenu, 'spriteStyle', 'ec.g', 've.w', 'bool'],
    [LocalisedText, 'defaultChatcol0', 'gb.o', 'bk.R', 'object'],
    [LocalisedText, 'defaultChatcol1', 'p.k', 'lb.D', 'object'],
    [LocalisedText, 'defaultChatcol2', 'gj.bb', 'h.wb', 'object'],
    [LocalisedText, 'defaultChatcol3', 'la.X', 'client.cb', 'object'],
    [LocalisedText, 'defaultChatcol4', 'dd.j', 'hd.p', 'object'],
    [LocalisedText, 'defaultChatcol5', 'af.E', 'bf.N', 'object'],
    [LocalisedText, 'defaultChatcol6', 'wa.p', 'mg.T', 'object'],
    [LocalisedText, 'defaultChatcol7', 'rg.j', 'tm.k', 'object'],
    [LocalisedText, 'defaultChatcol8', 'li.z', 'km.wc', 'object'],
    [LocalisedText, 'defaultChatcol9', 'mg.N', 'aa.d', 'object'],
    [LocalisedText, 'defaultChatcol10', 'di.f', 'vf.h', 'object'],
    [LocalisedText, 'defaultChatcol11', 'pi.g', 'ah.r', 'object'],
    [LocalisedText, 'chatcol0', 'gb.p', 'bk.L', 'object'],
    [LocalisedText, 'chatcol1', 'p.t', 'lb.q', 'object'],
    [LocalisedText, 'chatcol2', 'gj.ab', 'h.zb', 'object'],
    [LocalisedText, 'chatcol3', 'la.fb', 'client.X', 'object'],
    [LocalisedText, 'chatcol4', 'dd.h', 'hd.f', 'object'],
    [LocalisedText, 'chatcol5', 'af.K', 'bf.D', 'object'],
    [LocalisedText, 'chatcol6', 'wa.i', 'mg.W', 'object'],
    [LocalisedText, 'chatcol7', 'rg.k', 'tm.p', 'object'],
    [LocalisedText, 'chatcol8', 'li.w', 'km.Dc', 'object'],
    [LocalisedText, 'chatcol9', 'mg.I', 'aa.g', 'object'],
    [LocalisedText, 'chatcol10', 'di.j', 'vf.i', 'object'],
    [LocalisedText, 'chatcol11', 'pi.m', 'ah.q', 'object'],
    [LocalisedText, 'defaultChateffect1', 'l.t', 'dc.S', 'object'],
    [LocalisedText, 'defaultChateffect2', 'dk.S', 'pg.X', 'object'],
    [LocalisedText, 'defaultChateffect3', 'uh.db', 'rm.k', 'object'],
    [LocalisedText, 'defaultChateffect4', 'si.p', 'ef.t', 'object'],
    [LocalisedText, 'defaultChateffect5', 'vj.v', 'eg.u', 'object'],
    [LocalisedText, 'chateffect1', 'l.G', 'dc.hb', 'object'],
    [LocalisedText, 'chateffect2', 'dk.U', 'pg.hb', 'object'],
    [LocalisedText, 'chateffect3', 'uh.P', 'rm.j', 'object'],
    [LocalisedText, 'chateffect4', 'si.d', 'ef.o', 'object'],
    [LocalisedText, 'chateffect5', 'vj.p', 'eg.z', 'object']
];
const controls = new Map(fields.map(row => [row[1], row]));
function control(name: string) {
    const row = controls.get(name);
    if (!row) throw new Error('Missing script control ' + name);
    return row;
}
const aliases: Record<string, string> = { clanMembers: 'members', loginReply: 'reply', accountReply: 'reply' };
const defaultStream = Client.out;
const defaultGroups = IfType.m_list;
const defaultAreas = MapArea.areas,
    defaultSprites = Client.m_pSprites;
const extra = new Set(['operand', 'cipher', 'widgets', 'enum', 'param', 'gpu', 'area', 'sprites']);
const originals = new Map(fields.filter(([, name]) => !name.includes('.')).map(([owner, name]) => [name, Reflect.get(owner, aliases[name] ?? name)]));
const absent = -991;
type Scenario = [number, number | string, string];
function scenarios(): Scenario[] {
    const cases: Scenario[] = [];
    function add(op: number, ...variants: string[]) {
        for (const values of variants) cases.push([op, absent, values]);
    }
    for (const [op, name] of [
        [3305, 'statEffectiveLevel'],
        [3306, 'statBaseLevel'],
        [3307, 'statXP']
    ] as const) {
        for (const [index, values] of [
            [0, '73'],
            [-1, '73'],
            [0, 'null']
        ] as const)
            cases.push([op, index, name + '=' + values]);
    }
    add(3308, 'playerLevel=2 mapBuildBaseX=3217 localPlayer=new localPlayer.x=384 localPlayer.z=896 mapBuildBaseZ=3520', 'playerLevel=2 mapBuildBaseX=7 localPlayer=null mapBuildBaseZ=11');
    add(3316, 'staffModLevel=1', 'staffModLevel=2', 'staffModLevel=8');
    for (const op of [3323, 3324]) add(op, ...[4, 5, 9, 10].map(n => 'blackmarks=' + n));
    add(3326, 'localPlayer=null', 'localPlayer=new localPlayer.combatLevel=123');
    add(3327, 'localPlayer=null', 'localPlayer=new localPlayer.appearance=null', 'localPlayer=new localPlayer.appearance=new localPlayer.appearance.female=1');
    add(3328, 'underage=0 parentalChatConsent=1', 'underage=1 parentalChatConsent=0', 'underage=1 parentalChatConsent=1');
    add(3612, 'channelName=null memberCount=73', 'channelName=new memberCount=73');
    add(3621, 'friendState=0 ignoreCount=11', 'friendState=2 ignoreCount=11');
    for (const op of [3309, 3310, 3311]) cases.push([op, 0x23847659, '']);
    for (const op of [4000, 4001, 4002, 4003, 4007, 4008, 4009, 4010, 4011, 4012]) cases.push([op, '17,3', '']);
    cases.push([4003, '17,0', ''], [4011, '17,0', ''], [4004, 0, ''], [4005, -1, ''], [4006, '7,13,2,8,4', '']);
    add(3600, 'friendState=0 friendCount=17', 'friendState=1 friendCount=17', 'friendState=2 friendCount=17');
    for (const [op, name, value] of [
        [3601, 'friendUsername', 'objects:arsen'],
        [3602, 'friendWorld', '517'],
        [3603, 'friendRank', '87'],
        [3610, 'friendWorldName', 'objects:W76'],
        [3627, 'friendSameGame', '1']
    ] as const) {
        for (const [state, count, index] of [
            [0, 2, 0],
            [2, 0, 0],
            [2, 1, 0],
            [2, 2, -1]
        ])
            cases.push([op, index, 'friendState=' + state + ' friendCount=' + count + ' ' + name + '=' + value]);
    }
    for (const op of [3613, 3614, 3615, 3626])
        for (const [ch, count, array] of [
            ['null', 1, 'objects:new'],
            ['text:clan', 0, 'null'],
            ['text:clan', 1, 'objects:null'],
            ['text:clan', 1, 'objects:new']
        ])
            cases.push([op, 0, 'channelName=' + ch + ' memberCount=' + count + ' clanMembers=' + array]);
    add(3611, 'channelName=null', 'channelName=text:clan');
    add(3625, 'ownerName=null', 'ownerName=text:bob');
    for (const [state, count, value] of [
        [0, 1, 123],
        [2, 0, 123],
        [2, 1, 123],
        [2, 1, 0]
    ])
        cases.push([3622, 0, 'friendState=' + state + ' ignoreCount=' + count + ' ignoreName37=' + value]);
    for (const [op, name, value] of [
        [3616, 'minKick', 7],
        [3618, 'selfRank', 42],
        [3629, 'country', 73],
        [5000, 'chatPublicMode', 2],
        [5005, 'chatPrivateMode', 1],
        [5016, 'chatTradeMode', 3],
        [5017, 'count', 13],
        [5607, 'loginReply', 5],
        [5608, 'hopTime', 17],
        [5609, 'accountReply', 7],
        [5611, 'disallowResult', 19]
    ] as const)
        add(op, name + '=' + value);
    for (const op of [3903, 3904, 3905, 3906, 3907, 3908, 3910, 3911, 3912, 3913])
        for (const [index, v] of [
            [0, 'objects:new'],
            [0, 'objects:null'],
            [1, 'objects:new']
        ] as const)
            cases.push([op, index, 'grandExchangeOffers=' + v]);
    for (const op of [5100, 5101, 5102]) add(op, 'pressed=0', 'pressed=1', 'pressed=null');
    for (const op of [4211, 5072])
        for (const [arr, idx, n] of [
            ['null', 0, 1],
            ['-5', 1, 1],
            ['-5', 0, 1],
            ['-5', 1, 2]
        ])
            add(op, 'searchResults=' + arr + ' searchResultIndex=' + idx + ' resultCount=' + n);
    for (const op of [4212, 5073]) add(op, 'searchResultIndex=13');
    for (const [op, input] of [
        [5600, 's:bob,s:secret,0'],
        [5603, '1,2,3,4'],
        [5604, 's:bob'],
        [5605, '1,2,3,4,s:bob,s:pw'],
        [6500, absent],
        [6503, 21]
    ] as const) {
        const gates = ['gameState', 'worldLookupStep', 'loginStep', 'step', 'fetchStep'];
        const count = op >= 6500 ? 4 : 5;
        for (let bad = 0; bad <= count; bad++) {
            if (op === 6500 && bad === count) continue;
            const config = gates.map((name, i) => name + '=' + (bad === i ? 1 : i === 0 ? 10 : 0)).join(' ');
            cases.push([op, input, config]);
        }
    }
    for (const op of [5602, 5606]) for (const value of [0, 1]) add(op, op === 5602 ? 'loginStep=' + value + ' loginReply=77' : 'step=' + value + ' accountReply=77');
    for (const [type, first, limit] of [
        ['chatcol', 0, 12],
        ['chateffect', 1, 6]
    ] as const) {
        const setup = Array.from({ length: limit - first }, (_, j) => type + (first + j) + '=text:' + type + (first + j) + ':').join(' ');
        for (let i = first; i < limit; i++) {
            cases.push([5008, 's:' + type + i + ':hello', 'language=1 staffModLevel=2 ' + setup]);
        }
    }
    for (const text of ['hi', 'glow2:hello', 'slide:hi', 'scroll:hi']) cases.push([5008, 's:' + text, 'language=0 staffModLevel=2']);
    add(5610, 'suggestedNames=null', 'suggestedNames=objects:bob');
    for (const op of [5059, 5061]) add(op, 'quickChatPacketsSent=2147483647 cipher=1', 'quickChatPacketsSent=17');
    cases.push([5001, '1,2,3', 'cipher=1']);
    for (const [op, input] of [
        [3107, 's:bob,1'],
        [3301, '5,2'],
        [3302, '5,2'],
        [3303, '5,2'],
        [3304, 7],
        [3313, '7,1'],
        [3314, '7,1'],
        [3315, '7,1'],
        [3330, 7],
        [3331, '5,2'],
        [3332, '5,2'],
        [3400, '2,4'],
        [3408, '115,115,8,2'],
        [3410, '2,4'],
        [3411, 3],
        [3604, 's:bob,1'],
        [3617, 's:bob'],
        [5001, '1,2,3'],
        [5065, '3,-1'],
        [5071, 's:bob,1'],
        [5206, 23],
        [5300, '32,24'],
        [5420, absent],
        [5422, '0,s:,s:'],
        [5424, '1,2,3,4,5,6,7,8,9,10,11'],
        [5425, absent],
        [5426, 3],
        [5427, '1,2'],
        [6016, 1],
        [6021, 0],
        [6023, 2],
        [6501, absent],
        [6506, 7],
        [6507, '1,0,2,1'],
        [6600, 1],
        [4500, '1,2'],
        [4400, '1,2'],
        [4210, 's:bob,0'],
        [4100, 's:qty,7'],
        [4102, 's:qty,7'],
        [4104, 100],
        [4106, 67],
        [4117, 's:bob'],
        [4118, 's:four,1,3'],
        [4119, 's:one<hell>two'],
        [4120, 's:test,116'],
        [4121, 's:bob,s:b,0'],
        [4124, 's:test,2']
    ] as const)
        cases.push([op, input, '']);
    for (const op of [3623, 3628, 3609]) for (const name of ['bob', '<img=0>bob', '<img=1>bob']) cases.push([op, 's:' + name, 'friendCount=0 ignoreCount=0 localPlayer=null']);
    for (const op of [4105]) for (const appearance of ['localPlayer=null', 'localPlayer=new localPlayer.appearance=null', 'localPlayer=new localPlayer.appearance=new localPlayer.appearance.female=1']) cases.push([op, 's:one,s:two', appearance]);
    for (const op of [403]) for (const body of [2, 5, 8]) cases.push([op, body + ',0', 'maleKitBodyParts=2 femaleBodyParts=5 localPlayer=null']);
    add(-7, 'frameCount=0');
    add(-8, 'frameCount=0');
    add(-9, 'frameCount=0');
    for (const op of [-8, -9]) add(op, 'modeWhere=1', 'modeWhere=0');
    for (const [op, input] of [
        [3400, '8,2'],
        [3408, '115,115,8,2'],
        [3410, '8,s:Bob'],
        [3411, 8]
    ] as const)
        cases.push([op, input, 'enum=8']);
    cases.push([4400, '1,2', 'param=2:105'], [4500, '1,3', 'param=3:115']);
    for (const v of [0, 1]) cases.push([6016, 1, 'gpu=' + v + ' canvasInvalid=0'], [6019, 47, 'musicVolume=0 midiSong=' + v + ' m_pMidi=null signlink=null']);
    for (const os of ['linux', 'windows']) for (const ie of [0, 1]) cases.push([5421, 's:page,1', 'platform=1 osNameLower=raw:' + os + ' haveIe6=' + ie + ' signlink=null']);
    cases.push([5424, '1,2,3,4,5,6,7,8,9,10,11', 'sprites=1'], [5206, 2, 'area=1']);
    cases.push(
        [200, '0,-1', 'activeComponent=new widgets=1'],
        [201, 0, 'activeComponent=new activeComponent2=null widgets=1 operand=1'],
        [1801, 1, 'activeComponent=new activeComponent.operationNames=objects:Open'],
        [1802, absent, 'activeComponent=new activeComponent.opBaseValue=null'],
        [2801, '1,0', 'activeComponent=new activeComponent.operationNames=objects:Open widgets=1'],
        [2602, 0, 'activeComponent=new widgets=1'],
        [1400, '7,s:hello,s:s', 'activeComponent=new'],
        [4124, '123456,1', 'language=0'],
        [5212, absent, ''],
        [5213, absent, '']
    );
    for (const clan of ['null', 'objects:null', 'objects:new', 'objects:friend']) cases.push([3624, 0, 'clanMembers=' + clan + ' memberCount=1 localPlayer=new localPlayer.username=text:bob']);
    add(6601, 'steppedCameraKeys=0', 'steppedCameraKeys=1');
    add(5209, 'baseX=300 baseZ=400 height=98 centerX=7 centerZ=12');
    for (const [op, input] of [
        [101, absent],
        [200, '0,1'],
        [201, 0],
        [1000, '1,2,3,4'],
        [1005, 1],
        [1300, '1,s:act'],
        [1301, '0,0'],
        [1302, 1],
        [1303, 8],
        [1304, 7],
        [1305, 's:name'],
        [1306, 's:verb'],
        [1500, absent],
        [1501, absent],
        [1502, absent],
        [1602, absent],
        [1801, 1],
        [1802, absent],
        [3109, '4,6'],
        [1700, absent],
        [1400, '1,s:'],
        [1100, '0,0'],
        [1121, '1,2'],
        [2400, '1,s:,0'],
        [2602, 0],
        [2801, '1,0'],
        [2702, 1],
        [2704, '1,2']
    ] as const) {
        for (const active of [0, 1]) cases.push([op, input, 'activeComponent=new activeComponent2=new operand=' + active]);
    }
    for (const [op, name] of [
        [3300, 'loopCycle'],
        [3312, 'members'],
        [3317, 'rebootTimer'],
        [3318, 'selectedWorldId'],
        [3321, 'runenergy'],
        [3322, 'runWeight'],
        [3325, 'playerMember'],
        [3329, 'mapQuickChat'],
        [3333, 'loginType'],
        [3335, 'language'],
        [3337, 'affiliateId']
    ] as const) {
        add(op, name + '=' + (control(name)[4] === 'bool' ? 1 : 173));
    }
    return cases;
}
function trace(row: string): string {
    const [cmd, arg, failAt, ...config] = row.split(' ');
    const op = Number(cmd),
        inputs = arg === String(absent) ? [] : arg.split(','),
        events: string[] = [],
        writes: string[] = [];
    let active = false,
        result = 'ok';
    const stack = new Int32Array(32).fill(absent),
        stopped = Symbol();
    const observedStack = new Proxy(stack, {
        get(target, key) {
            if (active && typeof key === 'string' && /^\d+$/.test(key)) {
                events.push('index' + key);
                if (events.length === Number(failAt)) throw stopped;
            }
            return Reflect.get(target, key, target);
        }
    });
    const stringStack: (JagString | null)[] = new Array(32).fill(null);
    const observedStrings = new Proxy(stringStack, {
        get(target, key) {
            if (active && typeof key === 'string' && /^\d+$/.test(key)) {
                events.push('sindex' + key);
                if (events.length === Number(failAt)) throw stopped;
            }
            return Reflect.get(target, key, target);
        }
    });
    const values = new Map<string, unknown>(originals);
    values.set('intStack', observedStack);
    values.set('stringStack', observedStrings);
    let operand = 0;
    Client.out = defaultStream;
    IfType.m_list = defaultGroups;
    MapArea.areas = defaultAreas;
    Client.m_pSprites = defaultSprites;
    Client.setWindowMode = () => {};
    for (const entry of config.filter(Boolean)) {
        const [name, encoded] = entry.split('=');
        if (name === 'operand') {
            operand = Number(encoded);
            continue;
        }
        if (name === 'gpu') {
            GlRenderer.active = encoded === '1';
            continue;
        }
        if (name === 'sprites') {
            const js5 = new Js5(null, false, true);
            Reflect.set(js5, 'index', { fileCapacities: new Int32Array(0) });
            Client.m_pSprites = js5;
            continue;
        }
        if (name === 'area') {
            MapArea.areas = new SharedPtrList();
            MapArea.areas.push_back(MapArea.decode(new PacketT(Uint8Array.of(65, 0, 65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 8, 0, 8))));
            continue;
        }
        if (name === 'cipher') {
            Client.out = new SuperPacket(512);
            Client.out.SetEnc(new Int32Array(4));
            continue;
        }
        if (name === 'widgets') {
            IfType.m_list = [[values.get('activeComponent') as IfType]];
            continue;
        }
        if (name === 'enum') {
            const e = new EnumType();
            e.input = 115;
            e.m_outputType = 115;
            EnumType.m_recentUse.Put(BigInt(encoded), e);
            continue;
        }
        if (name === 'param') {
            const [id, type] = encoded.split(':');
            const p = new ParamType();
            Reflect.set(p, 'type', Number(type));
            ParamType.m_recentUse.Put(BigInt(id), p);
            continue;
        }
        const type = control(name)[4];
        let value: unknown;
        if (encoded === 'null') value = null;
        else if (encoded === 'new') value = type === 'widget' ? new IfType() : {};
        else if (encoded.startsWith('text:')) value = fromJsString(encoded.slice(5));
        else if (encoded.startsWith('raw:')) value = encoded.slice(4);
        else if (encoded.startsWith('objects:')) {
            const item = encoded.slice(8);
            if (item === 'friend') {
                const f = new FriendChatUser();
                f.name = fromJsString('Bob');
                value = [f];
            } else value = [item === 'null' ? null : item !== 'new' ? fromJsString(item) : type === 'offers' ? new StockPlayerOffer() : new FriendChatUser()];
        } else if (type === 'flags') value = new Uint8Array(128).fill(Number(encoded));
        else if (type === 'shorts') value = Int16Array.of(Number(encoded));
        else if (type === 'longs') value = BigInt64Array.of(BigInt(encoded));
        else if (type === 'array') value = Int32Array.of(Number(encoded));
        else value = type === 'bool' ? encoded === '1' : Number(encoded);
        const last = name.lastIndexOf('.');
        if (last >= 0) Reflect.set(values.get(name.slice(0, last)) as object, name.slice(last + 1), value);
        values.set(name, value);
    }
    for (const [owner, name] of fields) {
        if (name.includes('.') || !values.has(name)) continue;
        function observe(label: string, trace: string | undefined) {
            const line = trace?.split('\n')[2]?.match(/ScriptRunner\.ts:(\d+):/);
            if (active && line) {
                events.push(process.env.RS530_SCRIPT_SITE_TRACES ? label + '@' + line[1] : label);
                if (events.length === Number(failAt)) throw stopped;
                return true;
            }
            return false;
        }
        Object.defineProperty(owner, aliases[name] ?? name, {
            configurable: true,
            get() {
                if (active) observe(name, new Error().stack);
                return values.get(name);
            },
            set(value: unknown) {
                if (active && observe('set-' + name, new Error().stack)) writes.push(name + '=' + (value === null ? 'null' : typeof value === 'object' ? 'object' : Number(value)));
                values.set(name, value);
            }
        });
    }
    const script = new ClientScript();
    const ops = new Int32Array(op === -7 ? [40, 21] : op < 0 ? [9999] : [...inputs.map(value => (value.startsWith('s:') ? 3 : 0)), op, 21]);
    script.opcodes = new Proxy(ops, {
        get(target, key) {
            const value = Reflect.get(target, key, target);
            if (op >= 0 && typeof key === 'string' && /^\d+$/.test(key)) active = value === op;
            return value;
        }
    });
    script.intOperands = new Int32Array(op === -7 ? [2, 0] : [...inputs.map(value => (value.startsWith('s:') ? 0 : Number(value))), operand, 0]);
    if (op === -7) script.intLocals = 1;
    if (op === -8) script.name = fromJsString('broken');
    const child = new ClientScript();
    child.opcodes = Int32Array.of(21);
    child.intOperands = Int32Array.of(0);
    script.stringOperands = [...inputs.map(value => (value.startsWith('s:') ? fromJsString(value.slice(2)) : null)), null, null];
    const hook = new HookReq();
    hook.args = op === -7 ? [1, 17] : [1];
    active = op < 0;
    try {
        new ScriptRunner(
            id => (id === 1 ? script : child),
            () => {
                active = false;
                result = 'report';
            }
        ).ExecuteScript(hook, 100);
    } catch (error) {
        if (error !== stopped) throw error;
        result = 'stop';
    }
    return events.join(',') + '|' + result + '|' + stack[0] + '|' + (stringStack[0] === null ? 'null' : toJsString(stringStack[0])) + '|' + writes.join(',');
}
if (process.argv.includes('--trace')) {
    for (const row of readFileSync(0, 'utf8').trim().split(/\r?\n/)) console.log(trace(row));
} else
    test('CS2 static reads, faults and stack stores match the opcode path in each JAR', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-cs2-static-'));
        function run(cmd: string[], stdin = '', identity = 'sd') {
            const proc = Bun.spawnSync(cmd, { stdin: Buffer.from(stdin), env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity } });
            if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
            return proc.stdout.toString().trim().split(/\r?\n/);
        }
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            run(['javac', asm, '-d', dir, join(import.meta.dir, 'game/ScriptLocalsOracle.java'), join(import.meta.dir, 'game/ScriptStaticOracle.java')]);
            const differences = new Map<string, string>();
            for (const [identity, pack, idx] of [
                ['sd', gamepackPath, 2],
                ['gl', hdGamepackPath, 3]
            ] as const) {
                const header =
                    fields
                        .filter(([, name]) => !name.includes('.'))
                        .map(row => row[idx] + '=' + row[1])
                        .join(' ') + '\n';
                const base = ['java', asm, '-Drs530.siteHints=' + !!process.env.RS530_SCRIPT_SITE_TRACES, '-cp', [dir, pack, joglPath].join(delimiter), 'ScriptStaticOracle', identity];
                run([...base, pack, dir], header);
                const ts: string[] = [],
                    java: string[] = [];
                const vectors = scenarios().map(([op, arg, config]) => {
                    const setup = config
                        .split(' ')
                        .filter(Boolean)
                        .map(pair => {
                            const [name, val] = pair.split('=');
                            return (extra.has(name) ? name : control(name)[idx]) + '=' + val;
                        })
                        .join(' ');
                    return { op, arg, config, setup };
                });
                const baselines = run(base, header + vectors.map(v => v.op + ' ' + v.arg + ' 0 ' + v.setup).join('\n'));
                for (const [i, { op, arg, config, setup }] of vectors.entries()) {
                    const faults = baselines[i].split('|')[0].split(',').filter(Boolean).length;
                    for (let fault = 0; fault <= faults; fault++) {
                        const prefix = op + ' ' + arg + ' ' + fault + ' ';
                        ts.push(prefix + config);
                        java.push(prefix + setup);
                    }
                }
                const expected = run(base, header + java.join('\n'));
                const actual = run([process.execPath, import.meta.path, '--trace'], ts.join('\n'), identity);
                expect(expected).toHaveLength(ts.length);
                expect(actual).toHaveLength(ts.length);
                const evidence: { input: string; jar: string; ts: string }[] = [];
                for (let i = 0; i < ts.length; i++) {
                    const js = actual[i].replace(/@\d+/g, ''),
                        jvm = expected[i].replace(/@\d+/g, '');
                    const opcode = identity + ' ' + ts[i].split(' ')[0];
                    if (js !== jvm && !differences.has(opcode)) differences.set(opcode, identity + ' ' + ts[i] + ' Java=' + jvm + ' TS=' + js);
                    if (process.env.RS530_SCRIPT_SITE_TRACES && ts[i].split(' ')[2] === '0') evidence.push({ input: ts[i], jar: expected[i], ts: actual[i] });
                }
                if (process.env.RS530_SCRIPT_SITE_TRACES) writeFileSync(join(process.env.RS530_SCRIPT_SITE_TRACES, identity + '.json'), JSON.stringify(evidence));
            }
            expect([...differences.values()]).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30000);
