import Protocol from '#/io/Protocol';
import PacketT from '#/io/PacketT';
import ClientPlayer from '#/dash3d/ClientPlayer';
import SeqType from '#/config/SeqType';
import SpotType from '#/config/SpotType';
import AreaSoundManager from '#/sound/AreaSoundManager';
import ClientApp from './Client';
import ChatHistory from '#/game/ChatHistory';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import QuickChatPhrase from './QuickChatPhrase';
import WordPack from '#/io/WordPack';
import JagString from '#/datastruct/JagString';
import { arrayAtB64, arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';

export default class ReceivePlayerPositions {
    static m_lastNum = 0; // fe.R:I
    static readonly m_lastID = new Int32Array(2048); // ad.h:[I
    static readonly m_apCache = new Array<PacketT | null>(2048).fill(null); // d.d:[Lgd;

    static readonly m_tempP = new PacketT(new Uint8Array(5000)); // ll.l:Lgd;

    // sc.e(I)V
    static GetPlayerInfo(): void {
        ClientApp.entityRemovalCount = 0;
        ClientApp.entityUpdateCount = 0;
        ReceivePlayerPositions.readLocalPlayer();
        ReceivePlayerPositions.readOldPlayers();
        ReceivePlayerPositions.readNewPlayers();
        ReceivePlayerPositions.GetPlayerPositionsExtended();
        for (let i = 0; i < ClientApp.entityRemovalCount; i++) {
            const id = arrayAtI32(ClientApp.entityRemovalIds, i);
            const player = requireNonNull(arrayAtObj(ClientApp.players, id));
            if (player.lastUpdate !== ClientApp.loopCycle) {
                if (player.soundRadius > 0) AreaSoundManager.removePlayer(player);
                arrayPutObj(ClientApp.players, id, null);
            }
        }
        if (Protocol.packetSize !== Protocol.inPacket.m_pos) throw Error('gpp1 pos:' + Protocol.inPacket.m_pos + ' psize:' + Protocol.packetSize);
        for (let i = 0; i < ReceivePlayerPositions.m_lastNum; i++) {
            if (arrayAtObj(ClientApp.players, arrayAtI32(ReceivePlayerPositions.m_lastID, i)) === null) throw Error('gpp2 pos:' + i + ' size:' + ReceivePlayerPositions.m_lastNum);
        }
    }

    // qk.f(I)V
    private static readLocalPlayer(): void {
        Protocol.inPacket.GBitStart();
        if (Protocol.inPacket.gBit(1) !== 0) {
            const movement = Protocol.inPacket.gBit(2);
            if (movement === 0) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, 2047);
            else if (movement === 1) {
                const direction = Protocol.inPacket.gBit(3);
                requireNonNull(ClientApp.localPlayer).step(direction, 1, 3, -128);
                if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, 2047);
            } else if (movement !== 2) {
                if (movement === 3) {
                    const z = Protocol.inPacket.gBit(7);
                    const jump = Protocol.inPacket.gBit(1);
                    ClientApp.playerLevel = Protocol.inPacket.gBit(2);
                    if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, 2047);
                    const x = Protocol.inPacket.gBit(7);
                    requireNonNull(ClientApp.localPlayer).move(jump === 1, z, x);
                }
            } else {
                if (Protocol.inPacket.gBit(1) === 1) {
                    const a = Protocol.inPacket.gBit(3);
                    requireNonNull(ClientApp.localPlayer).step(a, 2, 3, -104);
                    const b = Protocol.inPacket.gBit(3);
                    requireNonNull(ClientApp.localPlayer).step(b, 2, 3, -126);
                } else {
                    const direction = Protocol.inPacket.gBit(3);
                    requireNonNull(ClientApp.localPlayer).step(direction, 0, 3, -109);
                }
                if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, 2047);
            }
        }
    }

    // bc.a(Z)V
    private static readOldPlayers(): void {
        const count = Protocol.inPacket.gBit(8);
        if (ReceivePlayerPositions.m_lastNum > count) {
            for (let i = count; i < ReceivePlayerPositions.m_lastNum; i++) arrayPutI32(ClientApp.entityRemovalIds, ClientApp.entityRemovalCount++, arrayAtI32(ReceivePlayerPositions.m_lastID, i));
        }
        if (ReceivePlayerPositions.m_lastNum < count) throw Error('gppov1');
        ReceivePlayerPositions.m_lastNum = 0;
        for (let i = 0; i < count; i++) {
            const id = arrayAtI32(ReceivePlayerPositions.m_lastID, i);
            const player = arrayAtObj(ClientApp.players, id);
            if (Protocol.inPacket.gBit(1) === 0) {
                arrayPutI32(ReceivePlayerPositions.m_lastID, ReceivePlayerPositions.m_lastNum++, id);
                requireNonNull(player).lastUpdate = ClientApp.loopCycle;
            } else {
                const type = Protocol.inPacket.gBit(2);
                if (type === 0) {
                    arrayPutI32(ReceivePlayerPositions.m_lastID, ReceivePlayerPositions.m_lastNum++, id);
                    requireNonNull(player).lastUpdate = ClientApp.loopCycle;
                    arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, id);
                } else if (type === 1) {
                    arrayPutI32(ReceivePlayerPositions.m_lastID, ReceivePlayerPositions.m_lastNum++, id);
                    requireNonNull(player).lastUpdate = ClientApp.loopCycle;
                    const direction = Protocol.inPacket.gBit(3);
                    requireNonNull(player).step(direction, 1, 3, 46);
                    if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, id);
                } else if (type === 2) {
                    arrayPutI32(ReceivePlayerPositions.m_lastID, ReceivePlayerPositions.m_lastNum++, id);
                    requireNonNull(player).lastUpdate = ClientApp.loopCycle;
                    if (Protocol.inPacket.gBit(1) === 1) {
                        const a = Protocol.inPacket.gBit(3);
                        requireNonNull(player).step(a, 2, 3, -92);
                        const b = Protocol.inPacket.gBit(3);
                        requireNonNull(player).step(b, 2, 3, 88);
                    } else {
                        const direction = Protocol.inPacket.gBit(3);
                        requireNonNull(player).step(direction, 0, 3, 113);
                    }
                    if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, id);
                } else if (type === 3) arrayPutI32(ClientApp.entityRemovalIds, ClientApp.entityRemovalCount++, id);
            }
        }
    }

    // oi.a(B)V
    private static readNewPlayers(): void {
        while (Protocol.inPacket.BitsLeft(Protocol.packetSize) >= 11) {
            const id = Protocol.inPacket.gBit(11);
            if (id === 2047) break;
            let created = false;
            if (arrayAtObj(ClientApp.players, id) === null) {
                created = true;
                arrayPutObj(ClientApp.players, id, new ClientPlayer());
                const appearance = arrayAtObj(ReceivePlayerPositions.m_apCache, id);
                if (appearance !== null) requireNonNull(arrayAtObj(ClientApp.players, id)).readAppearance(appearance);
            }
            arrayPutI32(ReceivePlayerPositions.m_lastID, ReceivePlayerPositions.m_lastNum++, id);
            const player = requireNonNull(arrayAtObj(ClientApp.players, id));
            player.lastUpdate = ClientApp.loopCycle;
            if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(ClientApp.entityUpdateIds, ClientApp.entityUpdateCount++, id);
            let x = Protocol.inPacket.gBit(5);
            if (x > 15) x -= 32;
            const yaw = arrayAtI32(ClientApp.FACING_MAP, Protocol.inPacket.gBit(3));
            if (created) player.targetYaw = player.yaw = yaw;
            const jump = Protocol.inPacket.gBit(1);
            let z = Protocol.inPacket.gBit(5);
            if (z > 15) z -= 32;
            const self = requireNonNull(ClientApp.localPlayer);
            player.move(jump === 1, (arrayAtI32(self.pathZ, 0) + z) | 0, (arrayAtI32(self.pathX, 0) + x) | 0);
        }
        Protocol.inPacket.GBitEnd();
    }

    // lf.b(I)V
    private static GetPlayerPositionsExtended(): void {
        for (let i = 0; i < ClientApp.entityUpdateCount; i++) {
            const id = arrayAtI32(ClientApp.entityUpdateIds, i);
            const player = arrayAtObj(ClientApp.players, id);
            let mask = Protocol.inPacket.g1();
            if ((mask & 16) !== 0) mask = (mask + (Protocol.inPacket.g1() << 8)) | 0;
            ReceivePlayerPositions.DecodeExtend(id, player, mask);
        }
    }

    // il.a(ILpb;II)V
    private static DecodeExtend(id: number, player: ClientPlayer | null, mask: number): void {
        if ((mask & 128) !== 0) {
            let flags = Protocol.inPacket.g2_alt1();
            const quick = (flags & 32768) !== 0;
            const rights = Protocol.inPacket.g1();
            const length = Protocol.inPacket.g1();
            const start = Protocol.inPacket.m_pos;
            if (requireNonNull(player).username !== null && requireNonNull(player).appearance !== null) {
                const p = requireNonNull(player);
                const sender = requireNonNull(p.username).toBase37();
                let suppressed = false;
                if (rights <= 1) {
                    if (!quick && ((ClientApp.underage && !ClientApp.parentalChatConsent) || ClientApp.mapQuickChat)) {
                        suppressed = true;
                    } else {
                        for (let i = 0; i < ClientApp.ignoreCount; i++) {
                            if (arrayAtB64(ClientApp.ignoreName37, i) === sender) {
                                suppressed = true;
                                break;
                            }
                        }
                    }
                }
                if (!suppressed && ClientApp.withinTutorialIsland === 0) {
                    let phrase = -1;
                    let text: JagString;
                    ReceivePlayerPositions.m_tempP.m_pos = 0;
                    Protocol.inPacket.gdataReverse(length, 0, ReceivePlayerPositions.m_tempP.m_data);
                    ReceivePlayerPositions.m_tempP.m_pos = 0;
                    if (quick) {
                        flags &= 32767;
                        const message = QuickChatPhrase.read(ReceivePlayerPositions.m_tempP);
                        phrase = message.id;
                        text = requireNonNull(message.type).GetText(ReceivePlayerPositions.m_tempP);
                    } else {
                        text = PixfontGeneric.escape(WordPack.read(ReceivePlayerPositions.m_tempP).sentenceCase());
                    }
                    p.overheadText = text.trim();
                    p.chatEffect = flags & 255;
                    p.chatTimer = 150;
                    p.chatColour = flags >> 8;
                    if (rights === 2) {
                        ChatHistory.AddChat(phrase, text, null, quick ? 17 : 1, JagString.join([ClientApp.modCrownTag, p.getDisplayName()]));
                    } else if (rights === 1) {
                        ChatHistory.AddChat(phrase, text, null, quick ? 17 : 1, JagString.join([ClientApp.modIconTag, p.getDisplayName()]));
                    } else {
                        ChatHistory.AddChat(phrase, text, null, quick ? 17 : 2, p.getDisplayName());
                    }
                }
            }
            Protocol.inPacket.m_pos = (start + length) | 0;
        }
        if ((mask & 1) !== 0) {
            const damage = Protocol.inPacket.gSmart1or2();
            const type = Protocol.inPacket.g1_alt1();
            requireNonNull(player).addHit(damage, ClientApp.loopCycle, type);
            requireNonNull(player).healthUntil = (300 + ClientApp.loopCycle) | 0;
            requireNonNull(player).health = Protocol.inPacket.g1_alt3();
        }
        if ((mask & 8) !== 0) {
            let seq = Protocol.inPacket.g2();
            if (seq === 65535) seq = -1;
            const delay = Protocol.inPacket.g1();
            ClientApp.TriggerPlayerAnim(seq, delay, requireNonNull(player));
        }
        if ((mask & 4) !== 0) {
            const length = Protocol.inPacket.g1_alt1();
            const data = new Uint8Array(length);
            const packet = new PacketT(data);
            Protocol.inPacket.gArrayBuffer(length, 0, data);
            arrayPutObj(ReceivePlayerPositions.m_apCache, id, packet);
            requireNonNull(player).readAppearance(packet);
        }
        if ((mask & 2) !== 0) {
            const face = Protocol.inPacket.g2_alt2();
            requireNonNull(player).faceEntity = face;
            if (face === 65535) requireNonNull(player).faceEntity = -1;
        }
        if ((mask & 1024) !== 0) {
            const startX = Protocol.inPacket.g1_alt2();
            const p = requireNonNull(player);
            p.exactStartX = startX;
            p.exactStartZ = Protocol.inPacket.g1();
            p.exactEndX = Protocol.inPacket.g1_alt1();
            p.exactEndZ = Protocol.inPacket.g1();
            p.exactStartTick = (Protocol.inPacket.g2_alt1() + ClientApp.loopCycle) | 0;
            p.exactEndTick = (Protocol.inPacket.g2_alt1() + ClientApp.loopCycle) | 0;
            p.exactDirection = Protocol.inPacket.g1_alt2();
            p.seqPathLength = 0;
            p.pathLength = 1;
        }
        if ((mask & 32) !== 0) {
            const text = Protocol.inPacket.gStringNoConversion();
            const p = requireNonNull(player);
            p.overheadText = text;
            if (text.charAt(0) !== 126) {
                if (ClientApp.localPlayer === p) ClientApp.AddChat(text, p.getDisplayName(), 2);
            } else {
                p.overheadText = text.substringFrom(1);
                ClientApp.AddChat(p.overheadText, p.getDisplayName(), 2);
            }
            p.chatColour = 0;
            p.chatTimer = 150;
            p.chatEffect = 0;
        }
        if ((mask & 512) !== 0) {
            const damage = Protocol.inPacket.gSmart1or2();
            const type = Protocol.inPacket.g1_alt3();
            requireNonNull(player).addHit(damage, ClientApp.loopCycle, type);
        }
        if ((mask & 2048) !== 0) {
            const count = Protocol.inPacket.g1_alt2(),
                seqs = new Int32Array(count),
                slots = new Int32Array(count),
                delays = new Int32Array(count);
            for (let i = 0; i < count; i++) {
                let seq = Protocol.inPacket.g2_alt1();
                if (seq === 65535) seq = -1;
                seqs[i] = seq;
                delays[i] = Protocol.inPacket.g1_alt1();
                slots[i] = Protocol.inPacket.g2();
            }
            ClientPlayer.applySlotAnims(seqs, delays, player, slots);
        }
        if ((mask & 256) !== 0) {
            let spot = Protocol.inPacket.g2_alt1();
            if (spot === 65535) spot = -1;
            let accept = true;
            const packed = Protocol.inPacket.g4_alt3();
            const p = requireNonNull(player);
            if (spot !== -1 && p.spotanim !== -1 && SeqType.List(SpotType.List(spot).seq).m_priority < SeqType.List(SpotType.List(p.spotanim).seq).m_priority) accept = false;
            if (accept) {
                p.spotHeight = packed >> 16;
                p.spotNext = 1;
                p.spotStart = (ClientApp.loopCycle + (packed & 65535)) | 0;
                p.spotanim = spot;
                p.spotFrame = 0;
                if (p.spotStart > ClientApp.loopCycle) p.spotFrame = -1;
                p.spotCycle = 0;
                if (p.spotanim !== -1 && ClientApp.loopCycle === p.spotStart) {
                    const seq = SpotType.List(p.spotanim).seq;
                    if (seq !== -1) {
                        const type = SeqType.List(seq);
                        if (type.frames !== null) ClientApp.TriggerSeqSound(type, p.z, p.x, ClientApp.localPlayer === p, 0);
                    }
                }
            }
        }
        if ((mask & 64) !== 0) {
            const x = Protocol.inPacket.g2();
            requireNonNull(player).faceX = x;
            requireNonNull(player).faceZ = Protocol.inPacket.g2_alt3();
        }
    }
}
