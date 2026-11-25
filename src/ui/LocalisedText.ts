import JagString, { fromLiteral, hashTableInitStrings, linkableInitStrings } from '#/datastruct/JagString';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray';

export default class LocalisedText {
    private static languageCodeEn: JagString | null = fromLiteral('en'); // dl.k:Lid;
    private static languageCodeDe: JagString | null = fromLiteral('de'); // dl.f:Lid;
    private static languageCodeFr: JagString | null = fromLiteral('fr'); // dl.j:Lid;
    private static languageCodePt: JagString | null = fromLiteral('pt'); // dl.g:Lid;
    static readonly languageCodes = [this.languageCodeEn, this.languageCodeDe, this.languageCodeFr, this.languageCodePt]; // dl.p:[Lid;

    // fi.a(ILid;)I
    static getLanguageId(start: number, code: JagString | null): number {
        for (let i = start; i < LocalisedText.languageCodes.length; i++) {
            if (requireNonNull(arrayAtObj(LocalisedText.languageCodes, i)).equalsIgnoreCase(code)) return i;
        }
        return -1;
    }

    static readonly englishChatcol4 = fromLiteral('purple:'); // dd.p:Lid;
    static readonly germanChatcol4 = fromLiteral('lila:'); // ej.r:Lid;
    static readonly frenchChatcol4 = fromLiteral('violet:'); // bh.d:Lid;
    static chatcol4 = LocalisedText.englishChatcol4; // dd.h:Lid;

    static readonly englishCheckingForUpdates = fromLiteral('Checking for updates )2 '); // fe.U:Lid;
    static readonly germanCheckingForUpdates = fromLiteral('Suche nach Updates )2 '); // hh.ab:Lid;
    static readonly frenchCheckingForUpdates = fromLiteral('V-Brification des mises -9 jour )2 '); // b.M:Lid;
    static checkingForUpdates = LocalisedText.englishCheckingForUpdates; // fe.ab:Lid;

    static readonly englishConlost = fromLiteral('Connection lost)3'); // b.D:Lid;
    static readonly germanConlost = fromLiteral('Verbindung abgebrochen)3'); // pd.u:Lid;
    static readonly frenchConlost = fromLiteral('Connexion perdue)3'); // oa.b:Lid;
    static conlost = LocalisedText.englishConlost; // b.F:Lid;

    static englishStarted3dLibrary: JagString | null = linkableInitStrings.englishStarted3dLibrary; // jf.d:Lid;
    static readonly germanStarted3dLibrary = fromLiteral('3D)2Softwarebibliothek gestartet)3'); // rg.f:Lid;
    static readonly frenchStarted3dLibrary = fromLiteral('Librairie 3D d-Bmarr-Be'); // se.g:Lid;
    static started3dLibrary = LocalisedText.englishStarted3dLibrary; // jf.l:Lid;

    static readonly englishAllocatedMemory = fromLiteral('Allocated memory'); // pg.F:Lid;
    static readonly germanAllocatedMemory = fromLiteral('Zugewiesener Speicher)3'); // ib.T:Lid;
    static readonly frenchAllocatedMemory = fromLiteral('M-Bmoire attribu-Be'); // dl.c:Lid;
    static allocatedMemory = LocalisedText.englishAllocatedMemory; // pg.A:Lid;

    static readonly englishIgnoresFull = fromLiteral('Your ignore list is full)3 Max of 100 users)3'); // wk.t:Lid;
    static readonly germanIgnoresFull = fromLiteral('Ihre Ignorieren)2Liste ist voll)1 Sie k-Onnen nur 100 Spieler darauf eintragen)3'); // oh.f:Lid;
    static readonly frenchIgnoresFull = fromLiteral('Votre liste noire est pleine (X100 noms maximum(Y)3'); // lk.y:Lid;
    static ignoresFull = LocalisedText.englishIgnoresFull; // wk.u:Lid;

    static readonly englishChooseOption = fromLiteral('Choose Option'); // si.f:Lid;
    static readonly germanChooseOption = fromLiteral('W-=hlen Sie eine Option'); // li.x:Lid;
    static readonly frenchChooseOption = fromLiteral('Choisir une option'); // u.i:Lid;
    static chooseOption = LocalisedText.englishChooseOption; // si.q:Lid;

    static readonly englishRemoveFriend = fromLiteral('Please remove '); // pe.Z:Lid;
    static readonly germanRemoveFriend = fromLiteral('Bitte entfernen Sie '); // jb.db:Lid;
    static readonly frenchRemoveFriend = fromLiteral('Veuillez commencer par supprimer '); // ec.b:Lid;
    static removeFriend = LocalisedText.englishRemoveFriend; // pe.H:Lid;

    static readonly englishCreatedGameworld = fromLiteral('Created gameworld'); // ri.U:Lid;
    static readonly germanCreatedGameworld = fromLiteral('Spielwelt erstellt)3'); // fd.bb:Lid;
    static readonly frenchCreatedGameworld = fromLiteral('Monde de jeu cr-B-B'); // wd.k:Lid;
    static createdGameworld = LocalisedText.englishCreatedGameworld; // ri.P:Lid;

    static readonly englishCancel = fromLiteral('Cancel'); // dd.f:Lid;
    static readonly germanCancel = fromLiteral('Abbrechen'); // kh.E:Lid;
    static readonly frenchCancel = fromLiteral('Annuler'); // mg.Q:Lid;
    static cancel = LocalisedText.englishCancel; // dd.b:Lid;

    static readonly englishLoadingSprites = fromLiteral('Loading sprites )2 '); // nb.c:Lid;
    static readonly germanLoadingSprites = fromLiteral('Lade Sprites )2 '); // nl.Z:Lid;
    static readonly frenchLoadingSprites = fromLiteral('Chargement des sprites )2 '); // ca.r:Lid;
    static loadingSprites = LocalisedText.englishLoadingSprites; // nb.d:Lid;

    static readonly englishClose = fromLiteral('Close'); // ce.U:Lid;
    static readonly germanClose = linkableInitStrings.germanClose; // we.x:Lid;
    static readonly frenchClose = fromLiteral('Fermer'); // ab.V:Lid;
    static close = LocalisedText.englishClose; // ce.Q:Lid;

    static readonly englishMoreOptions = fromLiteral(' more options'); // ae.f:Lid;
    static readonly germanMoreOptions = fromLiteral(' weitere Optionen'); // sb.j:Lid;
    static readonly frenchMoreOptions = fromLiteral(' autres options'); // me.s:Lid;
    static MOREOPTIONS = LocalisedText.englishMoreOptions; // ae.i:Lid;

    static readonly englishAttack = fromLiteral('Attack'); // fd.Y:Lid;
    static readonly germanAttack = fromLiteral('Angreifen'); // se.A:Lid;
    static readonly frenchAttack = fromLiteral('Attaquer'); // ud.e:Lid;
    static attack = LocalisedText.englishAttack; // fd.eb:Lid;

    static readonly englishChatcol5 = fromLiteral('white:'); // af.P:Lid;
    static readonly germanChatcol5 = fromLiteral('weiss:'); // rg.e:Lid;
    static readonly frenchChatcol5 = fromLiteral('blanc:'); // r.Y:Lid;
    static chatcol5 = LocalisedText.englishChatcol5; // af.K:Lid;

    static readonly englishConnectedToUpdateServer = fromLiteral('Connected to update server'); // ud.c:Lid;
    static readonly germanConnectedToUpdateServer = fromLiteral('Verbindung zum Update)2Server hergestellt)3'); // da.g:Lid;
    static readonly frenchConnectedToUpdateServer = fromLiteral('Connect-B au serveur de mise -9 jour'); // sf.k:Lid;
    static connectedToUpdateServer = LocalisedText.englishConnectedToUpdateServer; // ud.h:Lid;

    static readonly englishStarting3dLibrary = fromLiteral('Starting 3d Library'); // ml.C:Lid;
    static readonly germanStarting3dLibrary = fromLiteral('Starte 3D)2Softwarebibliothek)3'); // wh.O:Lid;
    static readonly frenchStarting3dLibrary = fromLiteral('D-Bmarrage de la librairie 3D'); // li.C:Lid;
    static starting3dLibrary = LocalisedText.englishStarting3dLibrary; // ml.n:Lid;

    static readonly englishLoadedWorldList = fromLiteral('Loaded world list data'); // th.f:Lid;
    static readonly germanLoadedWorldList = fromLiteral('Liste der Welten geladen'); // ig.z:Lid;
    static readonly frenchLoadedWorldList = fromLiteral('Liste des serveurs charg-Be'); // fl.d:Lid;
    static loadedWorldList = LocalisedText.englishLoadedWorldList; // th.c:Lid;

    static readonly englishLoadingTextures = fromLiteral('Loading textures )2 '); // hc.i:Lid;
    static readonly germanLoadingTextures = fromLiteral('Lade Texturen )2 '); // q.d:Lid;
    static readonly frenchLoadingTextures = fromLiteral('Chargement des textures )2 '); // sj.G:Lid;
    static loadingTextures = LocalisedText.englishLoadingTextures; // hc.h:Lid;

    static readonly englishLevel = fromLiteral('level: '); // tg.H:Lid;
    static readonly germanLevel = fromLiteral('Stufe: '); // jl.l:Lid;
    static readonly frenchLevel = fromLiteral('niveau '); // fa.r:Lid;
    static level = LocalisedText.englishLevel; // tg.J:Lid;

    static readonly englishAttemptToReestablish = fromLiteral('Please wait )2 attempting to reestablish)3'); // ld.n:Lid;
    static readonly germanAttemptToReestablish = fromLiteral('Bitte warten Sie )2 es wird versucht)1 die Verbindung wiederherzustellen)3'); // kg.u:Lid;
    static readonly frenchAttemptToReestablish = fromLiteral('Veuillez patienter )2 tentative de r-Btablissement)3'); // mg.M:Lid;
    static attempt_to_reestablish = LocalisedText.englishAttemptToReestablish; // ld.m:Lid;

    static readonly englishChatcol2 = fromLiteral('green:'); // gj.N:Lid;
    static readonly germanChatcol2 = fromLiteral('gr-Un:'); // te.b:Lid;
    static readonly frenchChatcol2 = fromLiteral('vert:'); // la.T:Lid;
    static chatcol2 = LocalisedText.englishChatcol2; // gj.ab:Lid;

    static readonly englishChateffect4 = fromLiteral('scroll:'); // si.r:Lid;
    static readonly germanChateffect4 = fromLiteral('scrollen:'); // tb.e:Lid;
    static readonly frenchChateffect4 = fromLiteral('d-Broulement:'); // wf.F:Lid;
    static chateffect4 = LocalisedText.englishChateffect4; // si.d:Lid;

    static readonly englishLoadingInterfaces = fromLiteral('Loading interfaces )2 '); // ml.v:Lid;
    static readonly germanLoadingInterfaces = fromLiteral('Lade Benutzeroberfl-=che )2 '); // ck.r:Lid;
    static readonly frenchLoadingInterfaces = fromLiteral('Chargement des interfaces )2 '); // l.B:Lid;
    static loadingInterfaces = LocalisedText.englishLoadingInterfaces; // ml.k:Lid;

    static readonly englishSelfFriend = fromLiteral('You can(Wt add yourself to your own friend list)3'); // te.h:Lid;
    static readonly germanSelfFriend = fromLiteral('Sie k-Onnen sich selbst nicht auf Ihre Freunde)2Liste setzen(Q'); // kl.D:Lid;
    static readonly frenchSelfFriend = fromLiteral('Vous ne pouvez pas ajouter votre nom -9 votre liste d(Wamis)3'); // ud.k:Lid;
    static selfFriend = LocalisedText.englishSelfFriend; // te.i:Lid;

    static readonly englishChatcol6 = fromLiteral('flash1:'); // wa.f:Lid;
    static readonly germanChatcol6 = fromLiteral('blinken1:'); // wk.n:Lid;
    static readonly frenchChatcol6 = fromLiteral('clignotant1:'); // sg.g:Lid;
    static chatcol6 = LocalisedText.englishChatcol6; // wa.i:Lid;

    static readonly englishDrop = fromLiteral('Drop'); // vk.U:Lid;
    static readonly germanDrop = fromLiteral('Fallen lassen'); // oe.q:Lid;
    static readonly frenchDrop = fromLiteral('Poser'); // hg.d:Lid;
    static drop = LocalisedText.englishDrop; // vk.bb:Lid;

    static readonly englishChatcol8 = fromLiteral('flash3:'); // li.v:Lid;
    static readonly germanChatcol8 = fromLiteral('blinken3:'); // se.w:Lid;
    static readonly frenchChatcol8 = fromLiteral('clignotant3:'); // cf.b:Lid;
    static chatcol8 = LocalisedText.englishChatcol8; // li.w:Lid;

    static readonly englishLoadingConfig = hashTableInitStrings.englishLoadingConfig; // nc.a:Lid;
    static readonly germanLoadingConfig = fromLiteral('Lade Konfiguration )2 '); // qf.e:Lid;
    static readonly frenchLoadingConfig = fromLiteral('Chargement des fichiers config )2 '); // qh.g:Lid;
    static loadingConfig = LocalisedText.englishLoadingConfig; // nc.t:Lid;

    static readonly englishChateffect2 = fromLiteral('wave2:'); // dk.Q:Lid;
    static readonly germanChateffect2 = fromLiteral('welle2:'); // b.U:Lid;
    static readonly frenchChateffect2 = fromLiteral('ondulation2:'); // lf.k:Lid;
    static chateffect2 = LocalisedText.englishChateffect2; // dk.U:Lid;

    static readonly englishHidden = fromLiteral('Hidden'); // je.cb:Lid;
    static readonly germanHidden = fromLiteral('Versteckt'); // p.W:Lid;
    static readonly frenchHidden = fromLiteral('Cach-B'); // ve.c:Lid;
    static hidden = LocalisedText.englishHidden; // je.U:Lid;

    static readonly englishLoadedFonts = fromLiteral('Loaded fonts'); // ra.V:Lid;
    static readonly germanLoadedFonts = fromLiteral('Schrifts-=tze geladen)3'); // ok.G:Lid;
    static readonly frenchLoadedFonts = fromLiteral('Polices charg-Bes'); // n.f:Lid;
    static loadedFonts = LocalisedText.englishLoadedFonts; // ra.Y:Lid;

    static readonly englishOpenedTitleScreen = fromLiteral('Opened title screen'); // qi.V:Lid;
    static readonly germanOpenedTitleScreen = fromLiteral('Titelbild ge-Offnet)3'); // d.a:Lid;
    static readonly frenchOpenedTitleScreen = fromLiteral(',Mcran)2titre ouvert'); // wa.q:Lid;
    static openedTitleScreen = LocalisedText.englishOpenedTitleScreen; // qi.X:Lid;

    static readonly englishIgnoreFirst = fromLiteral(' from your ignore list first)3'); // pj.B:Lid;
    static readonly germanIgnoreFirst = fromLiteral(' zuerst von Ihrer Ignorieren)2Liste(Q'); // vi.Z:Lid;
    static readonly frenchIgnoreFirst = fromLiteral(' de votre liste noire)3'); // d.e:Lid;
    static ignoreFirst = LocalisedText.englishIgnoreFirst; // pj.J:Lid;

    static readonly englishLoadingWordpack = fromLiteral('Loading wordpack )2 '); // gd.ob:Lid;
    static readonly germanLoadingWordpack = fromLiteral('Lade Wordpack )2 '); // hh.jb:Lid;
    static readonly frenchLoadingWordpack = fromLiteral('Chargement du module texte )2 '); // qg.F:Lid;
    static loadingWordpack = LocalisedText.englishLoadingWordpack; // gd.x:Lid;

    static readonly englishSkill = fromLiteral('skill: '); // ck.F:Lid;
    static readonly germanSkill = fromLiteral('Fertigkeit: '); // o.X:Lid;
    static readonly frenchSkill = fromLiteral('comp-Btence '); // si.i:Lid;
    static skill = LocalisedText.englishSkill; // ck.s:Lid;

    static readonly englishRating = fromLiteral('rating: '); // wf.A:Lid;
    static readonly germanRating = fromLiteral('Kampfstufe: '); // og.b:Lid;
    static readonly frenchRating = fromLiteral('classement '); // ui.A:Lid;
    static rating = LocalisedText.englishRating; // wf.w:Lid;

    static readonly englishLoggedOut = fromLiteral(' has logged out)3'); // hi.h:Lid;
    static readonly germanLoggedOut = fromLiteral(' loggt sich aus)3'); // oa.k:Lid;
    static readonly frenchLoggedOut = fromLiteral(' s(West d-Bconnect-B)3'); // tb.z:Lid;
    static loggedOut = LocalisedText.englishLoggedOut; // hi.d:Lid;

    static readonly englishFriendsFull = fromLiteral('Your friend list is full)3 Max of 100 for free users)1 and 200 for members)3'); // ra.X:Lid;
    static readonly germanFriendsFull = fromLiteral('Ihre Freunde)2Liste ist voll(Q Maximale Eintr-=ge: Mitglieder 200)4freie Spieler 100'); // pe.R:Lid;
    static readonly frenchFriendsFull = fromLiteral('Votre liste d(Wamis est pleine (X100 noms maximum pour la version gratuite et 200 pour les abonn-Bs(Y)3'); // na.I:Lid;
    static friendsFull = LocalisedText.englishFriendsFull; // ra.T:Lid;

    static readonly englishLoadingTitleScreen = fromLiteral('Loading title screen )2 '); // hc.e:Lid;
    static readonly germanLoadingTitleScreen = fromLiteral('Lade Titelbild )2 '); // nk.fb:Lid;
    static readonly frenchLoadingTitleScreen = fromLiteral('Chargement de l(W-Bcran)2titre )2 '); // rg.d:Lid;
    static loadingTitleScreen = LocalisedText.englishLoadingTitleScreen; // hc.g:Lid;

    static readonly englishAlreadyFriend = fromLiteral(' is already on your friend list)3'); // jd.k:Lid;
    static readonly germanAlreadyFriend = fromLiteral(' steht bereits auf Ihrer Freunde)2Liste(Q'); // jg.p:Lid;
    static readonly frenchAlreadyFriend = fromLiteral(' est d-Bj-9 dans votre liste d(Wamis)3'); // id.bb:Lid;
    static alreadyFriend = LocalisedText.englishAlreadyFriend; // jd.j:Lid;

    static readonly englishPleaseWait = fromLiteral('Please wait)3)3)3'); // ve.i:Lid;
    static readonly germanPleaseWait = fromLiteral('Bitte warten Sie)3)3)3'); // r.W:Lid;
    static readonly frenchPleaseWait = fromLiteral('Veuillez patienter)3)3)3'); // ii.o:Lid;
    static PLEASEWAIT = LocalisedText.englishPleaseWait; // ve.l:Lid;

    static readonly englishMillionSuffixAmount = fromLiteral('M'); // ui.s:Lid;
    static readonly germanMillionSuffixAmount = fromLiteral('M'); // ac.l:Lid;
    static readonly frenchMillionSuffixAmount = fromLiteral('M'); // pg.B:Lid;
    static millionSuffixAmount = LocalisedText.englishMillionSuffixAmount; // ui.C:Lid;

    static readonly englishMenuSeparator = fromLiteral(' '); // pa.Q:Lid;
    static readonly germanMenuSeparator = fromLiteral(': '); // ej.k:Lid;
    static readonly frenchMenuSeparator = fromLiteral(' '); // ta.T:Lid;
    static MINISEPERATOR = LocalisedText.englishMenuSeparator; // pa.ub:Lid;

    static millionSuffix = LocalisedText.englishMillionSuffixAmount; // ui.x:Lid;

    static readonly englishUnableToFind = fromLiteral('Unable to find '); // kl.F:Lid;
    static readonly germanUnableToFind = hashTableInitStrings.germanUnableToFind; // gk.l:Lid;
    static readonly frenchUnableToFind = fromLiteral('Impossible de trouver '); // dd.q:Lid;
    static unableToFind = LocalisedText.englishUnableToFind; // kl.T:Lid;

    static readonly englishExamine = fromLiteral('Examine'); // kc.d:Lid;
    static readonly germanExamine = fromLiteral('Untersuchen'); // bk.nc:Lid;
    static readonly frenchExamine = fromLiteral('Examiner'); // ek.p:Lid;
    static examine = LocalisedText.englishExamine; // kc.k:Lid;

    static readonly englishThousandsSuffix2 = fromLiteral('K'); // c.x:Lid;
    static readonly germanThousandsSuffix2 = fromLiteral('T'); // c.r:Lid;
    static readonly frenchThousandsSuffix2 = fromLiteral('K'); // si.k:Lid;
    static thousandsSuffix2 = LocalisedText.englishThousandsSuffix2; // c.D:Lid;

    static readonly englishLoadingPleaseWait2 = fromLiteral('Loading )2 please wait)3'); // qd.r:Lid;
    static readonly germanLoadingPleaseWait2 = fromLiteral('Ladevorgang )2 bitte warten Sie)3'); // ll.s:Lid;
    static readonly frenchLoadingPleaseWait2 = fromLiteral('Chargement en cours)3 Veuillez patienter)3'); // fd.cb:Lid;
    static loadingPleaseWait2 = LocalisedText.englishLoadingPleaseWait2; // qd.s:Lid;

    static readonly englishDiscard = hashTableInitStrings.englishDiscard; // nc.k:Lid;
    static readonly germanDiscard = fromLiteral('Ablegen'); // fl.f:Lid;
    static readonly frenchDiscard = fromLiteral('Jeter'); // dl.l:Lid;
    static discard = LocalisedText.englishDiscard; // nc.h:Lid;

    static readonly englishPreparedSoundEngine = fromLiteral('Prepared sound engine'); // le.k:Lid;
    static readonly germanPreparedSoundEngine = fromLiteral('Musik)2Engine vorbereitet)3'); // aa.g:Lid;
    static readonly frenchPreparedSoundEngine = fromLiteral('Moteur son pr-Bpar-B'); // hh.cb:Lid;
    static preparedSoundEngine = LocalisedText.englishPreparedSoundEngine; // le.j:Lid;

    static readonly englishUse = fromLiteral('Use'); // le.b:Lid;
    static readonly germanUse = fromLiteral('Benutzen'); // ai.l:Lid;
    static readonly frenchUse = fromLiteral('Utiliser'); // pe.F:Lid;
    static use = LocalisedText.englishUse; // le.f:Lid;

    static readonly englishChatcol11 = fromLiteral('glow3:'); // pi.i:Lid;
    static readonly germanChatcol11 = fromLiteral('leuchten3:'); // gl.B:Lid;
    static readonly frenchChatcol11 = fromLiteral('brillant3:'); // ui.r:Lid;
    static chatcol11 = LocalisedText.englishChatcol11; // pi.m:Lid;

    static readonly englishLoadedInterfaces = fromLiteral('Loaded interfaces'); // mj.h:Lid;
    static readonly germanLoadedInterfaces = fromLiteral('Benutzeroberfl-=che geladen)3'); // ma.a:Lid;
    static readonly frenchLoadedInterfaces = fromLiteral('Interfaces charg-Bes'); // ca.b:Lid;
    static loadedInterfaces = LocalisedText.englishLoadedInterfaces; // mj.j:Lid;

    static readonly englishLoadedTextures = linkableInitStrings.englishLoadedTextures; // jf.c:Lid;
    static readonly germanLoadedTextures = fromLiteral('Texturen geladen)3'); // ob.cb:Lid;
    static readonly frenchLoadedTextures = fromLiteral('Textures charg-Bes'); // og.l:Lid;
    static loadedTextures = LocalisedText.englishLoadedTextures; // jf.e:Lid;

    static readonly englishChatcol3 = fromLiteral('cyan:'); // la.V:Lid;
    static readonly germanChatcol3 = fromLiteral('blaugr-Un:'); // gh.P:Lid;
    static readonly frenchChatcol3 = fromLiteral('cyan:'); // hi.k:Lid;
    static chatcol3 = LocalisedText.englishChatcol3; // la.fb:Lid;

    static readonly englishContinue = fromLiteral('Continue'); // ea.j:Lid;
    static readonly germanContinue = fromLiteral('Weiter'); // uf.n:Lid;
    static readonly frenchContinue = fromLiteral('Continuer'); // cl.g:Lid;
    static continue = LocalisedText.englishContinue; // ea.i:Lid;

    static readonly englishAlreadyIgnored = fromLiteral(' is already on your ignore list)3'); // uf.r:Lid;
    static readonly germanAlreadyIgnored = fromLiteral(' steht bereits auf Ihrer Ignorieren)2Liste(Q'); // sk.P:Lid;
    static readonly frenchAlreadyIgnored = fromLiteral(' est d-Bj-9 dans votre liste noire)3'); // df.C:Lid;
    static alreadyIgnored = LocalisedText.englishAlreadyIgnored; // uf.q:Lid;

    static readonly englishLoadingFonts = fromLiteral('Loading fonts )2 '); // dg.k:Lid;
    static readonly germanLoadingFonts = fromLiteral('Lade Schrifts-=tze )2 '); // cg.c:Lid;
    static readonly frenchLoadingFonts = fromLiteral('Chargement des polices )2 '); // fd.db:Lid;
    static loadingFonts = LocalisedText.englishLoadingFonts; // dg.i:Lid;

    static readonly englishLoadedUpdateList = fromLiteral('Loaded update list'); // vk.qb:Lid;
    static readonly germanLoadedUpdateList = fromLiteral('Update)2Liste geladen)3'); // od.Y:Lid;
    static readonly frenchLoadedUpdateList = fromLiteral('Liste des mises -9 jour charg-Be'); // uj.c:Lid;
    static loadedUpdateList = LocalisedText.englishLoadedUpdateList; // vk.X:Lid;

    static readonly englishMembersObject = fromLiteral('Members object'); // vc.S:Lid;
    static readonly germanMembersObject = fromLiteral('Gegenstand f-Ur Mitglieder'); // rj.b:Lid;
    static readonly frenchMembersObject = fromLiteral('Objet d(Wabonn-Bs'); // vg.eb:Lid;
    static membersObject = LocalisedText.englishMembersObject; // vc.K:Lid;

    static readonly englishChateffect1 = fromLiteral('wave:'); // l.v:Lid;
    static readonly germanChateffect1 = fromLiteral('welle:'); // wg.h:Lid;
    static readonly frenchChateffect1 = fromLiteral('ondulation:'); // ff.x:Lid;
    static chateffect1 = LocalisedText.englishChateffect1; // l.G:Lid;

    static readonly englishChateffect3 = fromLiteral('shake:'); // uh.V:Lid;
    static readonly germanChateffect3 = fromLiteral('sch-Utteln:'); // hl.S:Lid;
    static readonly frenchChateffect3 = fromLiteral('tremblement:'); // j.d:Lid;
    static chateffect3 = LocalisedText.englishChateffect3; // uh.P:Lid;

    static removeIgnore = LocalisedText.englishRemoveFriend; // pe.W:Lid;

    static readonly englishAllocatingMemory = fromLiteral('Allocating memory'); // kf.g:Lid;
    static readonly germanAllocatingMemory = fromLiteral('Speicher wird zugewiesen)3'); // si.s:Lid;
    static readonly frenchAllocatingMemory = fromLiteral('M-Bmoire en cours d(Wattribution'); // qe.kb:Lid;
    static allocatingMemory = LocalisedText.englishAllocatingMemory; // kf.f:Lid;

    static readonly englishChateffect5 = fromLiteral('slide:'); // vj.w:Lid;
    static readonly germanChateffect5 = fromLiteral('gleiten:'); // sj.F:Lid;
    static readonly frenchChateffect5 = fromLiteral('glissement:'); // t.D:Lid;
    static chateffect5 = LocalisedText.englishChateffect5; // vj.p:Lid;

    static thousandsSuffix = LocalisedText.englishThousandsSuffix2; // c.z:Lid;

    static readonly englishChatcol0 = fromLiteral('yellow:'); // gb.s:Lid;
    static readonly germanChatcol0 = fromLiteral('gelb:'); // de.s:Lid;
    static readonly frenchChatcol0 = fromLiteral('jaune:'); // ak.e:Lid;
    static chatcol0 = LocalisedText.englishChatcol0; // gb.p:Lid;

    static readonly englishLoading = fromLiteral('Loading)3)3)3'); // wd.a:Lid;
    static readonly germanLoading = fromLiteral('Lade)3)3)3'); // n.l:Lid;
    static readonly frenchLoading = fromLiteral('Chargement en cours)3)3)3'); // sg.d:Lid;
    static LOADINGDOTDOTDOT = LocalisedText.englishLoading; // wd.f:Lid;

    static readonly englishConnectingToUpdateServer = fromLiteral('Connecting to update server'); // hk.a:Lid;
    static readonly germanConnectingToUpdateServer = fromLiteral('Verbindung mit Update)2Server)3)3)3'); // vj.r:Lid;
    static readonly frenchConnectingToUpdateServer = fromLiteral('Connexion au serveur de mise -9 jour en cours'); // hl.B:Lid;
    static connectingToUpdateServer = LocalisedText.englishConnectingToUpdateServer; // hk.d:Lid;

    static readonly englishLoadedSprites = fromLiteral('Loaded sprites'); // v.M:Lid;
    static readonly germanLoadedSprites = fromLiteral('Sprites geladen)3'); // rk.n:Lid;
    static readonly frenchLoadedSprites = fromLiteral('Sprites charg-Bs'); // se.v:Lid;
    static loadedSprites = LocalisedText.englishLoadedSprites; // v.N:Lid;

    static readonly englishFaceHere = fromLiteral('Face here'); // si.g:Lid;
    static readonly germanFaceHere = fromLiteral('Hierhin drehen'); // ib.hb:Lid;
    static readonly frenchFaceHere = fromLiteral('Regarder dans cette direction'); // qc.V:Lid;
    static faceHere = LocalisedText.englishFaceHere; // si.m:Lid;

    static readonly englishLoadedInputHandler = fromLiteral('Loaded input handler'); // kg.e:Lid;
    static readonly germanLoadedInputHandler = fromLiteral('Eingabeprozedur geladen)3'); // uc.n:Lid;
    static readonly frenchLoadedInputHandler = fromLiteral('Gestionnaire de saisie charg-B'); // vg.S:Lid;
    static loadedInputHandler = LocalisedText.englishLoadedInputHandler; // kg.f:Lid;

    static readonly englishChatcol7 = fromLiteral('flash2:'); // rg.c:Lid;
    static readonly germanChatcol7 = fromLiteral('blinken2:'); // tk.b:Lid;
    static readonly frenchChatcol7 = fromLiteral('clignotant2:'); // vj.q:Lid;
    static chatcol7 = LocalisedText.englishChatcol7; // rg.k:Lid;

    static readonly englishWalkHere = fromLiteral('Walk here'); // ff.I:Lid;
    static readonly germanWalkHere = fromLiteral('Hierhin gehen'); // qh.a:Lid;
    static readonly frenchWalkHere = fromLiteral('Atteindre'); // wf.H:Lid;
    static walkHere = LocalisedText.englishWalkHere; // ff.P:Lid;

    static readonly englishChatcol10 = fromLiteral('glow2:'); // di.k:Lid;
    static readonly germanChatcol10 = fromLiteral('leuchten2:'); // ja.ob:Lid;
    static readonly frenchChatcol10 = fromLiteral('brillant2:'); // ba.i:Lid;
    static chatcol10 = LocalisedText.englishChatcol10; // di.j:Lid;

    static readonly englishFriendFirst = fromLiteral(' from your friend list first)3'); // uk.a:Lid;
    static readonly germanFriendFirst = fromLiteral(' zuerst von Ihrer Freunde)2Liste(Q'); // e.g:Lid;
    static readonly frenchFriendFirst = fromLiteral(' de votre liste d(Wamis)3'); // m.V:Lid;
    static friendFirst = LocalisedText.englishFriendFirst; // uk.j:Lid;

    static readonly englishLoadingWorldListData = fromLiteral('Loading world list data'); // ie.v:Lid;
    static readonly germanLoadingWorldListData = fromLiteral('Lade Liste der Welten'); // uh.X:Lid;
    static readonly frenchLoadingWorldListData = fromLiteral('Chargement de la liste des serveurs'); // sb.k:Lid;
    static loadingWorldListData = LocalisedText.englishLoadingWorldListData; // ie.x:Lid;

    static readonly englishLoadedWordpack = fromLiteral('Loaded wordpack'); // ib.U:Lid;
    static readonly germanLoadedWordpack = fromLiteral('Wordpack geladen)3'); // uh.S:Lid;
    static readonly frenchLoadedWordpack = fromLiteral('Module texte charg-B'); // cd.b:Lid;
    static loadedWordpack = LocalisedText.englishLoadedWordpack; // ib.W:Lid;

    static readonly englishLoggedIn = fromLiteral(' has logged in)3'); // pj.N:Lid;
    static readonly germanLoggedIn = fromLiteral(' loggt sich ein)3'); // j.e:Lid;
    static readonly frenchLoggedIn = fromLiteral(' s(West connect-B)3'); // jk.I:Lid;
    static loggedIn = LocalisedText.englishLoggedIn; // pj.Q:Lid;

    static readonly englishLoadedConfig = linkableInitStrings.englishLoadedConfig; // jf.h:Lid;
    static readonly germanLoadedConfig = fromLiteral('Konfig geladen)3'); // qi.L:Lid;
    static readonly frenchLoadedConfig = fromLiteral('Fichiers config charg-Bs'); // sg.a:Lid;
    static loadedConfig = LocalisedText.englishLoadedConfig; // jf.j:Lid;

    static readonly englishTradeRequest = fromLiteral('wishes to trade with you)3'); // client.lb:Lid;
    static readonly germanTradeRequest = fromLiteral('m-Ochte mit Ihnen handeln)3'); // d.i:Lid;
    static readonly frenchTradeRequest = fromLiteral('voudrait faire un -Bchange avec vous)3'); // aa.f:Lid;
    static tradeRequest = LocalisedText.englishTradeRequest; // client.kb:Lid;

    static readonly englishChatcol1 = fromLiteral('red:'); // p.T:Lid;
    static readonly germanChatcol1 = fromLiteral('rot:'); // tg.M:Lid;
    static readonly frenchChatcol1 = fromLiteral('rouge:'); // pg.K:Lid;
    static chatcol1 = LocalisedText.englishChatcol1; // p.t:Lid;

    static readonly englishSelect = fromLiteral('Select'); // bj.j:Lid;
    static readonly germanSelect = fromLiteral('Ausw-=hlen'); // sg.e:Lid;
    static readonly frenchSelect = fromLiteral('S-Blectionner'); // tg.u:Lid;
    static select = LocalisedText.englishSelect; // bj.n:Lid;

    static readonly englishChatcol9 = fromLiteral('glow1:'); // mg.K:Lid;
    static readonly germanChatcol9 = fromLiteral('leuchten1:'); // cf.d:Lid;
    static readonly frenchChatcol9 = fromLiteral('brillant1:'); // bh.k:Lid;
    static chatcol9 = LocalisedText.englishChatcol9; // mg.I:Lid;

    static readonly englishTake = fromLiteral('Take'); // kh.C:Lid;
    static readonly germanTake = fromLiteral('Nehmen'); // db.t:Lid;
    static readonly frenchTake = fromLiteral('Prendre'); // qg.J:Lid;
    static take = LocalisedText.englishTake; // kh.z:Lid;

    static readonly englishLoadedTitleScreen = fromLiteral('Loaded title screen'); // vc.H:Lid;
    static readonly germanLoadedTitleScreen = fromLiteral('Titelbild geladen)3'); // nh.R:Lid;
    static readonly frenchLoadedTitleScreen = fromLiteral(',Mcran)2titre charg-B'); // ed.l:Lid;
    static loadedTitleScreen = LocalisedText.englishLoadedTitleScreen; // vc.N:Lid;

    static readonly englishOk = fromLiteral('Ok'); // vi.cb:Lid;
    static readonly germanOk = fromLiteral('Okay'); // ff.M:Lid;
    static readonly frenchOk = fromLiteral('OK'); // hh.P:Lid;
    static ok = LocalisedText.englishOk; // vi.eb:Lid;

    static readonly englishLoadingPleaseWait = fromLiteral('RuneScape is loading )2 please wait)3)3)3'); // me.g:Lid;
    static readonly germanLoadingPleaseWait = fromLiteral('RuneScape wird geladen )2 bitte warten)3)3)3'); // ka.o:Lid;
    static readonly frenchLoadingPleaseWait = fromLiteral('Chargement de RuneScape en cours )2 veuillez patienter)3)3)3'); // n.m:Lid;
    static loadingPleaseWait = LocalisedText.englishLoadingPleaseWait; // me.v:Lid;

    static readonly englishSelfIgnore = fromLiteral('You can(Wt add yourself to your own ignore list)3'); // q.k:Lid;
    static readonly germanSelfIgnore = fromLiteral('Sie k-Onnen sich selbst nicht selbst auf Ihre Ignorieren)2Liste setzen(Q'); // ia.p:Lid;
    static readonly frenchSelfIgnore = fromLiteral('Vous ne pouvez pas ajouter votre nom -9 votre liste noire)3'); // wi.m:Lid;
    static selfIgnore = LocalisedText.englishSelfIgnore; // q.a:Lid;

    static readonly defaultChatcol5 = LocalisedText.englishChatcol5; // af.E:Lid;
    static readonly defaultChatcol4 = LocalisedText.englishChatcol4; // dd.j:Lid;
    static readonly defaultChatcol10 = LocalisedText.englishChatcol10; // di.f:Lid;
    static readonly defaultChateffect2 = LocalisedText.englishChateffect2; // dk.S:Lid;
    static readonly defaultChatcol0 = LocalisedText.englishChatcol0; // gb.o:Lid;
    static readonly defaultChatcol2 = LocalisedText.englishChatcol2; // gj.bb:Lid;
    static readonly defaultChateffect1 = LocalisedText.englishChateffect1; // l.t:Lid;
    static readonly defaultChatcol3 = LocalisedText.englishChatcol3; // la.X:Lid;
    static readonly defaultChatcol8 = LocalisedText.englishChatcol8; // li.z:Lid;
    static readonly defaultChatcol9 = LocalisedText.englishChatcol9; // mg.N:Lid;
    static readonly defaultChatcol1 = LocalisedText.englishChatcol1; // p.k:Lid;
    static readonly defaultChatcol11 = LocalisedText.englishChatcol11; // pi.g:Lid;
    static readonly defaultChatcol7 = LocalisedText.englishChatcol7; // rg.j:Lid;
    static readonly defaultChateffect4 = LocalisedText.englishChateffect4; // si.p:Lid;
    static readonly defaultChateffect3 = LocalisedText.englishChateffect3; // uh.db:Lid;
    static readonly defaultChateffect5 = LocalisedText.englishChateffect5; // vj.v:Lid;
    static readonly defaultChatcol6 = LocalisedText.englishChatcol6; // wa.p:Lid;

    static readonly TAG_BREAK = fromLiteral('<br>'); // le.i:Lid;
    static readonly loadingPercentStart = fromLiteral('<br>(X'); // ti.V:Lid;
    static readonly loadingPercentEnd = fromLiteral('(U(Y'); // tg.s:Lid;
    static language = 0; // hl.w:I

    // ii.a(BI)V
    static setLanguage(language: number): void {
        if (language !== 0) {
            if (language === 1) LocalisedText.setGerman();
            else if (language === 2) LocalisedText.setFrench();
            else throw new RangeError('language ' + language);
        }
    }

    // d.a(B)V
    private static setGerman(): void {
        LocalisedText.chatcol4 = LocalisedText.germanChatcol4;
        LocalisedText.checkingForUpdates = LocalisedText.germanCheckingForUpdates;
        LocalisedText.conlost = LocalisedText.germanConlost;
        LocalisedText.started3dLibrary = LocalisedText.germanStarted3dLibrary;
        LocalisedText.allocatedMemory = LocalisedText.germanAllocatedMemory;
        LocalisedText.ignoresFull = LocalisedText.germanIgnoresFull;
        LocalisedText.chooseOption = LocalisedText.germanChooseOption;
        LocalisedText.removeFriend = LocalisedText.germanRemoveFriend;
        LocalisedText.createdGameworld = LocalisedText.germanCreatedGameworld;
        LocalisedText.cancel = LocalisedText.germanCancel;
        LocalisedText.loadingSprites = LocalisedText.germanLoadingSprites;
        LocalisedText.close = LocalisedText.germanClose;
        LocalisedText.MOREOPTIONS = LocalisedText.germanMoreOptions;
        LocalisedText.attack = LocalisedText.germanAttack;
        LocalisedText.chatcol5 = LocalisedText.germanChatcol5;
        LocalisedText.connectedToUpdateServer = LocalisedText.germanConnectedToUpdateServer;
        LocalisedText.starting3dLibrary = LocalisedText.germanStarting3dLibrary;
        LocalisedText.loadedWorldList = LocalisedText.germanLoadedWorldList;
        LocalisedText.loadingTextures = LocalisedText.germanLoadingTextures;
        LocalisedText.level = LocalisedText.germanLevel;
        LocalisedText.attempt_to_reestablish = LocalisedText.germanAttemptToReestablish;
        LocalisedText.chatcol2 = LocalisedText.germanChatcol2;
        LocalisedText.chateffect4 = LocalisedText.germanChateffect4;
        LocalisedText.loadingInterfaces = LocalisedText.germanLoadingInterfaces;
        LocalisedText.selfFriend = LocalisedText.germanSelfFriend;
        LocalisedText.chatcol6 = LocalisedText.germanChatcol6;
        LocalisedText.drop = LocalisedText.germanDrop;
        LocalisedText.chatcol8 = LocalisedText.germanChatcol8;
        LocalisedText.loadingConfig = LocalisedText.germanLoadingConfig;
        LocalisedText.chateffect2 = LocalisedText.germanChateffect2;
        LocalisedText.hidden = LocalisedText.germanHidden;
        LocalisedText.loadedFonts = LocalisedText.germanLoadedFonts;
        LocalisedText.openedTitleScreen = LocalisedText.germanOpenedTitleScreen;
        LocalisedText.ignoreFirst = LocalisedText.germanIgnoreFirst;
        LocalisedText.loadingWordpack = LocalisedText.germanLoadingWordpack;
        LocalisedText.skill = LocalisedText.germanSkill;
        LocalisedText.rating = LocalisedText.germanRating;
        LocalisedText.loggedOut = LocalisedText.germanLoggedOut;
        LocalisedText.friendsFull = LocalisedText.germanFriendsFull;
        LocalisedText.loadingTitleScreen = LocalisedText.germanLoadingTitleScreen;
        LocalisedText.alreadyFriend = LocalisedText.germanAlreadyFriend;
        LocalisedText.PLEASEWAIT = LocalisedText.germanPleaseWait;
        LocalisedText.millionSuffixAmount = LocalisedText.germanMillionSuffixAmount;
        LocalisedText.MINISEPERATOR = LocalisedText.germanMenuSeparator;
        LocalisedText.millionSuffix = LocalisedText.germanMillionSuffixAmount;
        LocalisedText.unableToFind = LocalisedText.germanUnableToFind;
        LocalisedText.examine = LocalisedText.germanExamine;
        LocalisedText.thousandsSuffix2 = LocalisedText.germanThousandsSuffix2;
        LocalisedText.loadingPleaseWait2 = LocalisedText.germanLoadingPleaseWait2;
        LocalisedText.discard = LocalisedText.germanDiscard;
        LocalisedText.preparedSoundEngine = LocalisedText.germanPreparedSoundEngine;
        LocalisedText.use = LocalisedText.germanUse;
        LocalisedText.chatcol11 = LocalisedText.germanChatcol11;
        LocalisedText.loadedInterfaces = LocalisedText.germanLoadedInterfaces;
        LocalisedText.loadedTextures = LocalisedText.germanLoadedTextures;
        LocalisedText.chatcol3 = LocalisedText.germanChatcol3;
        LocalisedText.continue = LocalisedText.germanContinue;
        LocalisedText.alreadyIgnored = LocalisedText.germanAlreadyIgnored;
        LocalisedText.loadingFonts = LocalisedText.germanLoadingFonts;
        LocalisedText.loadedUpdateList = LocalisedText.germanLoadedUpdateList;
        LocalisedText.membersObject = LocalisedText.germanMembersObject;
        LocalisedText.chateffect1 = LocalisedText.germanChateffect1;
        LocalisedText.chateffect3 = LocalisedText.germanChateffect3;
        LocalisedText.removeIgnore = LocalisedText.germanRemoveFriend;
        LocalisedText.allocatingMemory = LocalisedText.germanAllocatingMemory;
        LocalisedText.chateffect5 = LocalisedText.germanChateffect5;
        LocalisedText.thousandsSuffix = LocalisedText.germanThousandsSuffix2;
        LocalisedText.chatcol0 = LocalisedText.germanChatcol0;
        LocalisedText.LOADINGDOTDOTDOT = LocalisedText.germanLoading;
        LocalisedText.connectingToUpdateServer = LocalisedText.germanConnectingToUpdateServer;
        LocalisedText.loadedSprites = LocalisedText.germanLoadedSprites;
        LocalisedText.faceHere = LocalisedText.germanFaceHere;
        LocalisedText.loadedInputHandler = LocalisedText.germanLoadedInputHandler;
        LocalisedText.chatcol7 = LocalisedText.germanChatcol7;
        LocalisedText.walkHere = LocalisedText.germanWalkHere;
        LocalisedText.chatcol10 = LocalisedText.germanChatcol10;
        LocalisedText.friendFirst = LocalisedText.germanFriendFirst;
        LocalisedText.loadingWorldListData = LocalisedText.germanLoadingWorldListData;
        LocalisedText.loadedWordpack = LocalisedText.germanLoadedWordpack;
        LocalisedText.loggedIn = LocalisedText.germanLoggedIn;
        LocalisedText.loadedConfig = LocalisedText.germanLoadedConfig;
        LocalisedText.tradeRequest = LocalisedText.germanTradeRequest;
        LocalisedText.chatcol1 = LocalisedText.germanChatcol1;
        LocalisedText.select = LocalisedText.germanSelect;
        LocalisedText.chatcol9 = LocalisedText.germanChatcol9;
        LocalisedText.take = LocalisedText.germanTake;
        LocalisedText.loadedTitleScreen = LocalisedText.germanLoadedTitleScreen;
        LocalisedText.ok = LocalisedText.germanOk;
        LocalisedText.loadingPleaseWait = LocalisedText.germanLoadingPleaseWait;
        LocalisedText.selfIgnore = LocalisedText.germanSelfIgnore;
    }

    // sk.e(I)V
    private static setFrench(): void {
        LocalisedText.chatcol11 = LocalisedText.frenchChatcol11;
        LocalisedText.rating = LocalisedText.frenchRating;
        LocalisedText.drop = LocalisedText.frenchDrop;
        LocalisedText.chooseOption = LocalisedText.frenchChooseOption;
        LocalisedText.loadingFonts = LocalisedText.frenchLoadingFonts;
        LocalisedText.faceHere = LocalisedText.frenchFaceHere;
        LocalisedText.hidden = LocalisedText.frenchHidden;
        LocalisedText.chatcol5 = LocalisedText.frenchChatcol5;
        LocalisedText.allocatingMemory = LocalisedText.frenchAllocatingMemory;
        LocalisedText.loadingWordpack = LocalisedText.frenchLoadingWordpack;
        LocalisedText.chateffect4 = LocalisedText.frenchChateffect4;
        LocalisedText.selfFriend = LocalisedText.frenchSelfFriend;
        LocalisedText.createdGameworld = LocalisedText.frenchCreatedGameworld;
        LocalisedText.loadedTitleScreen = LocalisedText.frenchLoadedTitleScreen;
        LocalisedText.removeFriend = LocalisedText.frenchRemoveFriend;
        LocalisedText.loadingTitleScreen = LocalisedText.frenchLoadingTitleScreen;
        LocalisedText.ok = LocalisedText.frenchOk;
        LocalisedText.chatcol0 = LocalisedText.frenchChatcol0;
        LocalisedText.thousandsSuffix2 = LocalisedText.frenchThousandsSuffix2;
        LocalisedText.chatcol8 = LocalisedText.frenchChatcol8;
        LocalisedText.connectedToUpdateServer = LocalisedText.frenchConnectedToUpdateServer;
        LocalisedText.checkingForUpdates = LocalisedText.frenchCheckingForUpdates;
        LocalisedText.loggedIn = LocalisedText.frenchLoggedIn;
        LocalisedText.unableToFind = LocalisedText.frenchUnableToFind;
        LocalisedText.loadedTextures = LocalisedText.frenchLoadedTextures;
        LocalisedText.loggedOut = LocalisedText.frenchLoggedOut;
        LocalisedText.openedTitleScreen = LocalisedText.frenchOpenedTitleScreen;
        LocalisedText.loadedUpdateList = LocalisedText.frenchLoadedUpdateList;
        LocalisedText.MINISEPERATOR = LocalisedText.frenchMenuSeparator;
        LocalisedText.cancel = LocalisedText.frenchCancel;
        LocalisedText.chatcol6 = LocalisedText.frenchChatcol6;
        LocalisedText.started3dLibrary = LocalisedText.frenchStarted3dLibrary;
        LocalisedText.millionSuffix = LocalisedText.frenchMillionSuffixAmount;
        LocalisedText.ignoresFull = LocalisedText.frenchIgnoresFull;
        LocalisedText.attempt_to_reestablish = LocalisedText.frenchAttemptToReestablish;
        LocalisedText.selfIgnore = LocalisedText.frenchSelfIgnore;
        LocalisedText.select = LocalisedText.frenchSelect;
        LocalisedText.loadedWorldList = LocalisedText.frenchLoadedWorldList;
        LocalisedText.loadingPleaseWait = LocalisedText.frenchLoadingPleaseWait;
        LocalisedText.preparedSoundEngine = LocalisedText.frenchPreparedSoundEngine;
        LocalisedText.loadingSprites = LocalisedText.frenchLoadingSprites;
        LocalisedText.close = LocalisedText.frenchClose;
        LocalisedText.alreadyFriend = LocalisedText.frenchAlreadyFriend;
        LocalisedText.tradeRequest = LocalisedText.frenchTradeRequest;
        LocalisedText.attack = LocalisedText.frenchAttack;
        LocalisedText.loadingInterfaces = LocalisedText.frenchLoadingInterfaces;
        LocalisedText.walkHere = LocalisedText.frenchWalkHere;
        LocalisedText.chatcol7 = LocalisedText.frenchChatcol7;
        LocalisedText.loadingConfig = LocalisedText.frenchLoadingConfig;
        LocalisedText.conlost = LocalisedText.frenchConlost;
        LocalisedText.friendFirst = LocalisedText.frenchFriendFirst;
        LocalisedText.level = LocalisedText.frenchLevel;
        LocalisedText.chatcol4 = LocalisedText.frenchChatcol4;
        LocalisedText.thousandsSuffix = LocalisedText.frenchThousandsSuffix2;
        LocalisedText.loadingTextures = LocalisedText.frenchLoadingTextures;
        LocalisedText.discard = LocalisedText.frenchDiscard;
        LocalisedText.membersObject = LocalisedText.frenchMembersObject;
        LocalisedText.take = LocalisedText.frenchTake;
        LocalisedText.alreadyIgnored = LocalisedText.frenchAlreadyIgnored;
        LocalisedText.PLEASEWAIT = LocalisedText.frenchPleaseWait;
        LocalisedText.loadedInputHandler = LocalisedText.frenchLoadedInputHandler;
        LocalisedText.loadedConfig = LocalisedText.frenchLoadedConfig;
        LocalisedText.chatcol3 = LocalisedText.frenchChatcol3;
        LocalisedText.loadedSprites = LocalisedText.frenchLoadedSprites;
        LocalisedText.removeIgnore = LocalisedText.frenchRemoveFriend;
        LocalisedText.skill = LocalisedText.frenchSkill;
        LocalisedText.chatcol9 = LocalisedText.frenchChatcol9;
        LocalisedText.friendsFull = LocalisedText.frenchFriendsFull;
        LocalisedText.MOREOPTIONS = LocalisedText.frenchMoreOptions;
        LocalisedText.connectingToUpdateServer = LocalisedText.frenchConnectingToUpdateServer;
        LocalisedText.chatcol10 = LocalisedText.frenchChatcol10;
        LocalisedText.loadingWorldListData = LocalisedText.frenchLoadingWorldListData;
        LocalisedText.chateffect5 = LocalisedText.frenchChateffect5;
        LocalisedText.LOADINGDOTDOTDOT = LocalisedText.frenchLoading;
        LocalisedText.loadedFonts = LocalisedText.frenchLoadedFonts;
        LocalisedText.starting3dLibrary = LocalisedText.frenchStarting3dLibrary;
        LocalisedText.loadingPleaseWait2 = LocalisedText.frenchLoadingPleaseWait2;
        LocalisedText.loadedInterfaces = LocalisedText.frenchLoadedInterfaces;
        LocalisedText.examine = LocalisedText.frenchExamine;
        LocalisedText.ignoreFirst = LocalisedText.frenchIgnoreFirst;
        LocalisedText.loadedWordpack = LocalisedText.frenchLoadedWordpack;
        LocalisedText.allocatedMemory = LocalisedText.frenchAllocatedMemory;
        LocalisedText.chateffect3 = LocalisedText.frenchChateffect3;
        LocalisedText.chatcol1 = LocalisedText.frenchChatcol1;
        LocalisedText.millionSuffixAmount = LocalisedText.frenchMillionSuffixAmount;
        LocalisedText.chatcol2 = LocalisedText.frenchChatcol2;
        LocalisedText.chateffect1 = LocalisedText.frenchChateffect1;
        LocalisedText.continue = LocalisedText.frenchContinue;
        LocalisedText.chateffect2 = LocalisedText.frenchChateffect2;
        LocalisedText.use = LocalisedText.frenchUse;
    }
}
