import FriendChatChannel from '#/client/FriendChatChannel.js';
import GameState from '#/game/GameState.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import StockPlayerOffer from '#/client/StockPlayerOffer.js';
import ClientInvCache from '#/client/ClientInvCache.js';
import Protocol from '#/io/Protocol.js';
import { fromJsString } from '#/datastruct/JagString.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';

import DelayedStateChange from '#/ui/DelayedStateChange.js';
import Minimenu from '#/ui/Minimenu.js';
import ChatHistory from '#/game/ChatHistory.js';

import LocType from '#/config/LocType.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import JavaRandom, { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

function trace(mode: string, seed: number): void {
    localAssets(cachePath, [3]);
    const marker = fromJsString('previous');
    const seeded = new JavaRandom(BigInt(seed));
    mathRandom.setSeed(BigInt(seed));
    GameShell.m_sWid = 765;
    GameShell.m_sHei = 503;
    const outbound = Client.out;
    const inbound = Protocol.inPacket;
    outbound.SetEnc(Int32Array.of(1, 2, 3, 4));
    outbound.m_pos = 9;
    inbound.m_pos = 7;
    Protocol.packetSize = 91;
    Client.gameState = 40;
    Client.mouseTracking = new MouseTracking();
    Client.mouseTracking.count = 12;
    Client.lastSentFocus = false;
    GameShell.m_focus = false;
    Client.prevMouseClickTime = 331n;
    Client.mouseRepeatCount = 8;
    Client.rebootTimer = 523;
    Client.destinationX = 88;
    Client.destinationZ = 67;
    Client.minimapState = 4;
    Protocol.idleReads = 55;
    Protocol.ptype1 = 23;
    Protocol.packetType = 77;
    Protocol.lastPacketType0 = 88;
    Protocol.ptype2 = 99;
    Client.logoutTimer = 2;
    Minimenu.isOpen = true;
    Minimenu.count = 17;
    OrbitCamera.mode = 3;
    ClientMouseListener.idleCycles = 27;
    Minimenu.objSelected = 2;
    Minimenu.targetMode = true;
    ChatHistory.count = 1234;
    Client.soundEffectCount = 7;
    Client.verifyId = 423;
    Protocol.sequenceAckPending = true;
    Client.showLoadingMessage = false;
    RoofModeStatics.roofRemovalDisabled = true;
    OrbitCamera.reportPending = false;
    Client.friendCount = 37;
    Client.friendState = 2;
    FriendChatChannel.memberCount = 1;
    FriendChatChannel.channelName = marker;
    FriendChatChannel.members = [null];
    ChatHistory.text[29] = marker;
    ChatHistory.names[17] = marker;
    DelayedStateChange.varcStrings[49] = marker;
    DelayedStateChange.varcs[49] = 1234;
    Client.statEffectiveLevel[7] = 46;
    Client.statBaseLevel[7] = 65;
    Client.statXP[7] = 123505;
    Minimenu.playerOption[4] = marker;
    Minimenu.playerCursor[4] = 19;
    Minimenu.playerSecondary[4] = true;
    const c = CinematicCamera;
    c.tileX = c.lookZ = c.lookHeight = c.step = c.lookX = c.factor = c.tileZ = c.height = c.lookFactor = c.lookStep = 97;
    for (let i = 0; i < 100; i++) InterfaceList.dirty[i] = seeded.nextInt() < 0;
    const player = new ClientPlayer(),
        npc = new ClientNpc();
    Client.localPlayer = Client.players[0] = Client.players[2047] = player;
    Client.npcs[12] = Client.npcs[32767] = npc;
    player.faceEntity = 721;
    npc.faceEntity = 932;
    ReceivePlayerPositions.m_lastNum = Client.npcCount = 2;
    InterfaceList.pressedContinue = new IfType();
    const oldInv = ClientInvCache.m_invList,
        oldLocs = Client.locChanges,
        oldPalette = Client.recolourPalette;
    const oldOffer = (requireNonNull(Client.grandExchangeOffers)[3] = new StockPlayerOffer());
    if (mode === 'broken') IfType.m_pInterfaces = null;
    if (mode === 'resume-input') Reflect.set(Protocol, 'inPacket', null);
    if (mode === 'resume-output') Reflect.set(Client, 'out', null);
    if (mode === 'resume-short') InterfaceList.dirty.length = 17;
    if (mode === 'resume-long') InterfaceList.dirty.push(false, false, false);
    let result = 'ok';
    try {
        if (mode.startsWith('resume')) {
            Client.ReconnectDone();
            new GameState({ outgoing: Client.out, rebuild: null, account: null });
        } else Client.resetGame();
    } catch (error) {
        result = mode.startsWith('resume') && error instanceof WrappedException ? String(error.context) : 'runtime';
    }
    const dirtyHash = InterfaceList.dirty.reduce((hash, dirty) => (Math.imul(hash, 31) + (dirty ? 1231 : 1237)) | 0, 1);
    console.log(
        [
            result,
            Client.gameState,
            Client.minimapState,
            Protocol.idleReads,
            Protocol.ptype1,
            Protocol.packetType,
            Protocol.lastPacketType0,
            Protocol.ptype2,
            Protocol.packetSize,
            inbound.m_pos,
            outbound.m_pos,
            Buffer.from(requireNonNull(outbound.m_data).subarray(0, outbound.m_pos)).toString('hex'),
            Minimenu.isOpen,
            Minimenu.count,
            Client.rebootTimer,
            Client.destinationX,
            Client.destinationZ,
            OrbitCamera.mode,
            ClientMouseListener.idleCycles,
            Minimenu.objSelected,
            Minimenu.targetMode,
            ChatHistory.count,
            Client.soundEffectCount,
            Client.verifyId,
            Protocol.sequenceAckPending,
            Client.showLoadingMessage,
            RoofModeStatics.roofRemovalDisabled,
            OrbitCamera.reportPending,
            Client.logoutTimer,
            Client.friendCount,
            Client.friendState,
            FriendChatChannel.memberCount,
            FriendChatChannel.channelName === marker,
            FriendChatChannel.members === null,
            ChatHistory.text[29] === marker,
            ChatHistory.names[17] === marker,
            DelayedStateChange.varcStrings[49] === marker,
            DelayedStateChange.varcs[49],
            Client.statEffectiveLevel[7],
            Client.statBaseLevel[7],
            Client.statXP[7],
            Minimenu.playerOption[4] === marker,
            Minimenu.playerCursor[4],
            Minimenu.playerSecondary[4],
            c.tileX,
            c.lookZ,
            c.lookHeight,
            c.step,
            c.lookX,
            c.factor,
            c.tileZ,
            c.height,
            c.lookFactor,
            c.lookStep,
            player.faceEntity,
            npc.faceEntity,
            Client.players[0] === null,
            Client.players[2047] === Client.localPlayer,
            Client.localPlayer === player,
            Client.npcs[12] === null,
            Client.npcs[32767] === null,
            ReceivePlayerPositions.m_lastNum,
            Client.npcCount,
            InterfaceList.pressedContinue === null,
            oldInv === ClientInvCache.m_invList,
            oldLocs === Client.locChanges,
            oldPalette === Client.recolourPalette,
            Client.recolourPalette === ObjType.recolourPalette,
            Client.recolourPalette === LocType.recolPalette,
            Client.recolourPalette === NpcType.clientPalette,
            oldOffer === requireNonNull(Client.grandExchangeOffers)[3],
            Client.mouseTracking.count,
            Client.lastSentFocus,
            GameShell.m_focus,
            Client.prevMouseClickTime,
            Client.mouseRepeatCount,
            dirtyHash
        ].join('/')
    );
}

if (process.argv[2] === 'trace') trace(process.argv[3], Number(process.argv[4]));
else {
    const { expect, test } = await import('bun:test');
    test('hg.a and tj.a reset dirty sessions, retain untouched state and stop at the same failed dereference as Java', () => {
        const dir = mkdtempSync(join(tmpdir(), 'loginreset530-'));
        try {
            const source = fileURLToPath(new URL('./game/LoginResetOracle.java', import.meta.url));
            const compiled = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
            for (const mode of ['fresh', 'resume', 'broken', 'resume-input', 'resume-output', 'resume-short', 'resume-long'])
                for (const seed of ['530', '2147483647']) {
                    const original = Bun.spawnSync(['java', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LoginResetOracle', mode, seed]);
                    expect(original.exitCode, original.stderr.toString()).toBe(0);
                    const actual = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace', mode, seed]);
                    expect(actual.exitCode, actual.stderr.toString()).toBe(0);
                    const expected = original.stdout.toString().trim().split('/');
                    const result = actual.stdout.toString().trim().split('/');
                    expect(result.length).toBe(expected.length);
                    for (let i = 0; i < expected.length; i++) expect(result[i], mode + ' ' + seed + ' property ' + i).toBe(expected[i]);
                }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30000);
}
