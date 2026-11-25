import { glJar } from '#/client/ClientVariant';

// SD tb.a and HD hj.a store these shorts in the menu. A GL gamepack keeps
// its own IDs when it switches to software rendering. The U and T suffixes
// denote using a selected item and targeting with a selected component.
function action(sd: number, hd: number): number {
    return glJar ? hd : sd;
}

const MinimenuOps = {
    OPLOC1: action(20, 42),
    OPLOC2: action(11, 50),
    OPLOC3: action(58, 49),
    OPLOC4: action(45, 46),
    OPLOC5: action(1003, 1001),
    OPLOCU: action(48, 14),
    OPLOCT: action(28, 38),
    EXAMINE_LOC: action(1004, 1004),

    OPNPC1: action(49, 17),
    OPNPC2: action(19, 16),
    OPNPC3: action(14, 4),
    OPNPC4: action(29, 19),
    OPNPC5: action(4, 2),
    OPNPCU: action(60, 26),
    OPNPCT: action(32, 45),
    EXAMINE_NPC: action(1007, 1007),

    OPPLAYER1: action(33, 30),
    OPPLAYER2: action(8, 6),
    OPPLAYER3: action(51, 31),
    OPPLAYER4: action(9, 29),
    OPPLAYER5: action(31, 10),
    OPPLAYER6: action(40, 44),
    OPPLAYER7: action(34, 37),
    OPPLAYER8: action(17, 57),
    OPPLAYERU: action(47, 1),
    OPPLAYERT: action(16, 15),

    OPOBJ1: action(21, 21),
    OPOBJ2: action(25, 34),
    OPOBJ3: action(7, 18),
    OPOBJ4: action(35, 20),
    OPOBJ5: action(43, 24),
    OPOBJU: action(36, 33),
    OPOBJT: action(24, 39),
    EXAMINE_OBJ: action(1006, 1002),

    OPHELD1: action(30, 47),
    OPHELD2: action(18, 5),
    OPHELD3: action(44, 43),
    OPHELD4: action(26, 35),
    OPHELD5: action(23, 58),
    OPHELDU: action(39, 40),
    OPHELDT: action(15, 3),
    SELECT_OBJ: action(12, 22),
    EXAMINE_HELD: action(1005, 1006),

    INV_BUTTON1: action(42, 25),
    INV_BUTTON2: action(50, 23),
    INV_BUTTON3: action(37, 48),
    INV_BUTTON4: action(1, 7),
    INV_BUTTON5: action(2, 13),

    IF_BUTTON: action(46, 8),
    SELECT_TARGET: action(6, 32),
    IF_CLOSE: action(3, 28),
    IF_TOGGLE: action(13, 59),
    IF_SET: action(10, 51),
    IF_CONTINUE: action(38, 41),
    IF_BUTTONX: action(59, 9),
    IF_BUTTONX_LOW_PRIORITY: action(1001, 1003),
    IF_BUTTONT: action(22, 12),

    WALK_HERE: action(57, 60),
    FACE_HERE: action(5, 36),
    TARGET_GROUND: action(41, 11),
    CANCEL: action(1002, 1005)
} as const;

export default MinimenuOps;
