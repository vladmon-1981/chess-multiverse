#!/usr/bin/env python3
"""ASO-тексты ChessGM (15.11.2026): генерирует AppStore/metadata/<локаль>/*.txt для 11 локалей страницы.

  python3 AppStore/aso_texts.py          # перезаписать файлы metadata (ru и en-US — правит только имя, подзаголовок,
                                         # ключи, промо и первый абзац описания; остальной текст берёт из файла)
  python3 AppStore/check_metadata.py     # проверка лимитов
  python3 AppStore/check_aso.py          # проверка повторов слов (название/подзаголовок/ключи)

Название меняется по решению владельца (15.11.2026): «ChessGM: <3D-шахматы на языке локали>».
Локаль kk в Connect не заведена и не трогается.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent / "metadata"

# ---- название, подзаголовок, ключевые слова, промо -------------------------------------------
META = {
    "ru": dict(
        name="ChessGM: 3D шахматы онлайн",
        subtitle="Играй вдвоём и с компьютером",
        keywords="детей,семейные,настольные,стратегия,головоломка,логика,игра,офлайн,ии,хоккей,машинки,обучение,друзья",
        promo="Шахматы для всей семьи: объёмные фигуры, четыре весёлые вселенные, игра вдвоём, с компьютером или онлайн. Подсветка ходов помогает новичкам и детям."),
    "en-US": dict(
        name="ChessGM: 3D Chess Game",
        subtitle="Play offline, online, 2 player",
        keywords="board,strategy,kids,family,multiplayer,friends,computer,ai,puzzle,brain,beginner,learn,hockey,racing",
        promo="Chess for the whole family: real 3D pieces, four fun universes, a friend on one device, the computer or online. Move hints help beginners and kids."),
    "en-GB": dict(
        name="ChessGM: 3D Chess Game",
        subtitle="Family fun, play vs computer",
        keywords="board,strategy,friends,beginner,learn,brain,puzzle,training,cartoon,hockey,racing,vet,multiplayer",
        promo="Chess for the whole family: real 3D pieces, four fun universes, a friend on one device, the computer or online. Move hints help beginners and kids."),
    "es-MX": dict(
        name="ChessGM: Juego de Ajedrez 3D",
        subtitle="Diversión para toda la familia",
        keywords="estrategia,tablero,computadora,amigos,aprender,principiante,hockey,carritos,multijugador,mental",
        promo="Ajedrez para toda la familia: piezas 3D, cuatro universos divertidos, juega con un amigo, contra la computadora o en línea. Las jugadas resaltadas ayudan a los novatos."),
    "es-ES": dict(
        name="ChessGM: Ajedrez 3D",
        subtitle="Online, offline y para dos",
        keywords="niños,familia,estrategia,tablero,jugadores,ordenador,amigos,aprender,principiante,hockey,coches",
        promo="Ajedrez para toda la familia: piezas 3D, cuatro universos divertidos, juega con un amigo, contra el ordenador o en línea. Las jugadas resaltadas ayudan a los novatos."),
    "de-DE": dict(
        name="ChessGM: 3D Schach",
        subtitle="Familienspiel, solo & zu zweit",
        keywords="Spiel,Brettspiel,Strategie,Rätsel,Offline,Online,Computer,Freunde,lernen,Anfänger,Eishockey,Autos",
        promo="Schach für die ganze Familie: 3D-Figuren, vier lustige Welten, zu zweit auf einem Gerät, gegen den Computer oder online. Zug-Hinweise helfen Anfängern und Kindern."),
    "fr-FR": dict(
        name="ChessGM: Échecs 3D",
        subtitle="Jeu en famille, solo ou duo",
        keywords="enfants,stratégie,hors,ligne,ordinateur,amis,apprendre,débutant,hockey,voitures,multijoueur,plateau",
        promo="Les échecs pour toute la famille : pièces 3D, quatre univers amusants, à deux sur un appareil, contre l’ordinateur ou en ligne. Les coups surlignés aident les débutants."),
    "it": dict(
        name="ChessGM: Scacchi 3D",
        subtitle="Gioco per tutta la famiglia",
        keywords="online,offline,strategia,scacchiera,due,giocatori,computer,amici,imparare,principiante,hockey,auto",
        promo="Scacchi per tutta la famiglia: pezzi 3D, quattro universi divertenti, in due sullo stesso schermo, contro il computer o online. Le mosse evidenziate aiutano chi inizia."),
    "pt-BR": dict(
        name="ChessGM: Xadrez 3D",
        subtitle="Jogo para toda a família",
        keywords="online,offline,estratégia,tabuleiro,dois,jogadores,computador,amigos,aprender,iniciante,hóquei",
        promo="Xadrez para toda a família: peças em 3D, quatro universos divertidos, em dois no mesmo aparelho, contra o computador ou online. Jogadas destacadas ajudam os iniciantes."),
    "pl": dict(
        name="ChessGM: Szachy 3D",
        subtitle="Gra dla całej rodziny",
        keywords="online,offline,strategia,plansza,dwóch,graczy,komputer,znajomi,nauka,początkujący,hokej,auta",
        promo="Szachy dla całej rodziny: figury 3D, cztery wesołe światy, we dwoje na jednym urządzeniu, z komputerem lub online. Podświetlane ruchy pomagają początkującym i dzieciom."),
    "uk": dict(
        name="ChessGM: 3D шахи онлайн",
        subtitle="Грай удвох і проти ШІ",
        keywords="дітей,сімейні,настільні,стратегія,головоломка,логіка,гра,офлайн,хокей,машинки,навчання,друзі",
        promo="Шахи для всієї родини: об’ємні фігури, чотири веселі всесвіти, гра вдвох, з комп’ютером або онлайн. Підсвітка ходів допомагає новачкам і дітям."),
}

# ---- описание: первый абзац для ru/en-US (остальное берётся из уже лежащего файла) ---------------
INTRO = {
    "ru": "ChessGM — 3D-шахматы для всей семьи: объёмные фигуры, четыре весёлые вселенные и подсветка ходов, которая помогает новичкам. Играйте вдвоём на одном экране, с компьютером на трёх уровнях или онлайн через Game Center. Работает и без интернета.",
    "en-US": "ChessGM is 3D chess for the whole family: real three-dimensional pieces, four fun universes and move hints that help beginners. Play a friend on one screen, the computer on three levels or online via Game Center. It works offline too.",
}

# ---- описание для остальных локалей (сокращённое; факты те же, что в ru/en-US) -------------------
# ключи: intro, h1, u1..u4, h2, p1..p4, h3, rules, h4, cam, h5, pro, h6, priv, iface
D = {
 "en-GB": dict(
  intro="ChessGM is 3D chess for the whole family: real three-dimensional pieces, four fun universes and move hints that help beginners. Play a friend on one screen, the computer on three levels or online via Game Center. It works offline too.",
  h1="FOUR UNIVERSES, FOUR SETS OF PIECES",
  u1="Classic: Staunton pieces in ivory and ebony on a maple and walnut board.",
  u2="Racing: cartoon cars with eyes on the windshield. Pieces drive, turn and crash.",
  u3="Vet Clinic: big-headed animal characters, staff against anomalies.",
  u4="Hockey: a rink with real markings, boards and stands. Pieces skate, and checkmate is a goal.",
  h2="PLAY YOUR WAY",
  p1="Computer opponent on three levels: Easy, Medium and Hard. The engine runs on your device.",
  p2="Two players on one device, with optional board turning after each move.",
  p3="Online via Game Center: a friend or a random opponent, 30 seconds to 5 minutes per move, rating and leaderboards.",
  p4="Legal moves and the last move are highlighted; undo a move, flip the board, resign or start over at any time.",
  h3="FULL CHESS RULES",
  rules="Castling, en passant, promotion with a choice of piece, check, checkmate, stalemate, threefold repetition, the fifty-move rule and insufficient material. Move the pieces by tapping or by dragging.",
  h4="A CAMERA THAT FOLLOWS YOU",
  cam="Rotate the board 360 degrees, tilt it, zoom with a pinch. A camera button cycles through ready-made angles; switch on cinematic mode and captures play in slow motion.",
  h5="SOUND AND HALL OF FAME",
  pro_snd="A neural-voice announcer, female or male, commentates the game in every universe. Wins earn points in the Hall of Fame on your device.",
  h6="CHESSGM PRO",
  pro="You can play 5 games a day for free. A one-time ChessGM Pro purchase removes that limit for good: no subscription, no ads.",
  h7="OFFLINE AND PRIVATE",
  priv="Playing the computer or a friend on one device needs no internet; only online games do. No accounts of our own, no ads and no tracking.",
  iface="The interface is available in English and Russian and follows your device language."),
 "es-MX": dict(
  intro="ChessGM es ajedrez 3D para toda la familia: piezas tridimensionales, cuatro universos divertidos y jugadas resaltadas que ayudan a los principiantes. Juega con un amigo en la misma pantalla, contra la computadora en tres niveles o en línea con Game Center. También funciona sin internet.",
  h1="CUATRO UNIVERSOS, CUATRO JUEGOS DE PIEZAS",
  u1="Clásico: piezas Staunton de marfil y ébano sobre un tablero de arce y nogal.",
  u2="Carreras: carritos de caricatura con ojos en el parabrisas. Las piezas avanzan, giran y chocan.",
  u3="Clínica veterinaria: animales cabezones, el personal contra las anomalías.",
  u4="Hockey: una pista con marcas reales, bandas y gradas. Las piezas patinan y el jaque mate es un gol.",
  h2="JUEGA COMO QUIERAS",
  p1="Contra la computadora en tres niveles: fácil, medio y difícil. El motor funciona en tu dispositivo.",
  p2="Dos jugadores en un mismo dispositivo, con giro opcional del tablero tras cada jugada.",
  p3="En línea con Game Center: un amigo o un rival al azar, de 30 segundos a 5 minutos por jugada, ranking y tablas de posiciones.",
  p4="Se resaltan las jugadas legales y la última jugada; puedes deshacer, girar el tablero, rendirte o empezar de nuevo.",
  h3="TODAS LAS REGLAS DEL AJEDREZ",
  rules="Enroque, captura al paso, coronación con elección de pieza, jaque, jaque mate, tablas por ahogado, triple repetición, regla de 50 movimientos y material insuficiente. Mueve las piezas tocando o arrastrando.",
  h4="UNA CÁMARA QUE TE SIGUE",
  cam="Gira el tablero 360 grados, inclínalo y acércalo con un pellizco. Un botón de cámara cambia entre ángulos listos; con el modo cine las capturas van en cámara lenta.",
  h5="SONIDO Y CUADRO DE HONOR",
  pro_snd="Un locutor con voz neuronal, femenina o masculina, comenta la partida en cada universo. Las victorias dan puntos en el cuadro de honor de tu dispositivo.",
  h6="CHESSGM PRO",
  pro="Puedes jugar 5 partidas al día gratis. Una compra única de ChessGM Pro quita el límite para siempre: sin suscripción ni anuncios.",
  h7="SIN INTERNET Y PRIVADO",
  priv="Jugar contra la computadora o con un amigo en el mismo dispositivo no requiere internet; solo las partidas en línea. Sin cuentas propias, sin anuncios y sin rastreo.",
  iface="La interfaz está en inglés y ruso, según el idioma de tu dispositivo."),
 "es-ES": dict(
  intro="ChessGM es ajedrez 3D para toda la familia: piezas tridimensionales, cuatro universos divertidos y jugadas resaltadas que ayudan a los principiantes. Juega con un amigo en la misma pantalla, contra el ordenador en tres niveles o en línea con Game Center. También funciona sin conexión.",
  h1="CUATRO UNIVERSOS, CUATRO JUEGOS DE PIEZAS",
  u1="Clásico: piezas Staunton de marfil y ébano sobre un tablero de arce y nogal.",
  u2="Carreras: coches de dibujos con ojos en el parabrisas. Las piezas avanzan, giran y embisten.",
  u3="Clínica veterinaria: animales cabezones, el personal contra las anomalías.",
  u4="Hockey: una pista con marcas reales, bandas y gradas. Las piezas patinan y el jaque mate es un gol.",
  h2="JUEGA COMO QUIERAS",
  p1="Contra el ordenador en tres niveles: fácil, medio y difícil. El motor funciona en tu dispositivo.",
  p2="Dos jugadores en un mismo dispositivo, con giro opcional del tablero tras cada jugada.",
  p3="En línea con Game Center: un amigo o un rival al azar, de 30 segundos a 5 minutos por jugada, clasificación y tablas de líderes.",
  p4="Se resaltan las jugadas legales y la última jugada; puedes deshacer, girar el tablero, rendirte o empezar de nuevo.",
  h3="TODAS LAS REGLAS DEL AJEDREZ",
  rules="Enroque, captura al paso, promoción con elección de pieza, jaque, jaque mate, tablas por rey ahogado, triple repetición, regla de los 50 movimientos y material insuficiente. Mueve las piezas tocando o arrastrando.",
  h4="UNA CÁMARA QUE TE SIGUE",
  cam="Gira el tablero 360 grados, inclínalo y acércalo con un pellizco. Un botón de cámara cambia entre ángulos preparados; con el modo cine las capturas van a cámara lenta.",
  h5="SONIDO Y CUADRO DE HONOR",
  pro_snd="Un locutor con voz neuronal, femenina o masculina, comenta la partida en cada universo. Las victorias dan puntos en el cuadro de honor de tu dispositivo.",
  h6="CHESSGM PRO",
  pro="Puedes jugar 5 partidas al día gratis. Una compra única de ChessGM Pro quita el límite para siempre: sin suscripción ni anuncios.",
  h7="SIN CONEXIÓN Y PRIVADO",
  priv="Jugar contra el ordenador o con un amigo en el mismo dispositivo no necesita internet; solo las partidas en línea. Sin cuentas propias, sin anuncios y sin rastreo.",
  iface="La interfaz está en inglés y ruso, según el idioma de tu dispositivo."),
 "de-DE": dict(
  intro="ChessGM ist 3D-Schach für die ganze Familie: echte dreidimensionale Figuren, vier lustige Welten und Zug-Hinweise, die Anfängern helfen. Spiele zu zweit auf einem Bildschirm, gegen den Computer in drei Stufen oder online über Game Center. Auch ohne Internet spielbar.",
  h1="VIER WELTEN, VIER FIGURENSÄTZE",
  u1="Klassik: Staunton-Figuren aus Elfenbein und Ebenholz auf einem Brett aus Ahorn und Nussbaum.",
  u2="Rennen: Comic-Autos mit Augen auf der Windschutzscheibe. Die Figuren fahren, wenden und rammen.",
  u3="Tierklinik: großköpfige Tierfiguren, das Personal gegen die Anomalien.",
  u4="Eishockey: Eisfläche mit echten Markierungen, Banden und Tribünen. Die Figuren laufen Schlittschuh, und Schachmatt ist ein Tor.",
  h2="SPIELE, WIE DU WILLST",
  p1="Computergegner in drei Stufen: leicht, mittel und schwer. Die Engine läuft auf deinem Gerät.",
  p2="Zwei Spieler an einem Gerät, auf Wunsch dreht sich das Brett nach jedem Zug.",
  p3="Online über Game Center: Freund oder Zufallsgegner, 30 Sekunden bis 5 Minuten pro Zug, Rangliste und Bestenlisten.",
  p4="Erlaubte Züge und der letzte Zug werden hervorgehoben; Zug zurück, Brett drehen, aufgeben oder neu starten jederzeit.",
  h3="ALLE SCHACHREGELN",
  rules="Rochade, en passant, Umwandlung mit Figurenwahl, Schach, Matt, Patt, dreifache Stellungswiederholung, 50-Züge-Regel und unzureichendes Material. Figuren per Tippen oder Ziehen bewegen.",
  h4="EINE KAMERA, DIE DIR FOLGT",
  cam="Brett um 360 Grad drehen, neigen und mit zwei Fingern zoomen. Ein Kamera-Knopf wechselt zwischen fertigen Perspektiven; im Kinomodus laufen Schlagzüge in Zeitlupe.",
  h5="TON UND EHRENTAFEL",
  pro_snd="Ein Sprecher mit neuronaler Stimme, weiblich oder männlich, kommentiert die Partie in jeder Welt. Siege bringen Punkte für die Ehrentafel auf deinem Gerät.",
  h6="CHESSGM PRO",
  pro="Täglich 5 Partien sind kostenlos. Der einmalige Kauf von ChessGM Pro hebt das Limit für immer auf: ohne Abo, ohne Werbung.",
  h7="OFFLINE UND PRIVAT",
  priv="Gegen den Computer oder zu zweit an einem Gerät brauchst du kein Internet; nur Online-Partien. Keine eigenen Konten, keine Werbung, kein Tracking.",
  iface="Die Oberfläche gibt es auf Englisch und Russisch, je nach Gerätesprache."),
 "fr-FR": dict(
  intro="ChessGM, ce sont les échecs en 3D pour toute la famille : de vraies pièces en trois dimensions, quatre univers amusants et des coups surlignés qui aident les débutants. Jouez à deux sur le même écran, contre l’ordinateur en trois niveaux ou en ligne via Game Center. Fonctionne aussi hors ligne.",
  h1="QUATRE UNIVERS, QUATRE JEUX DE PIÈCES",
  u1="Classique : pièces Staunton en ivoire et ébène sur un plateau en érable et noyer.",
  u2="Course : voitures de dessin animé avec des yeux sur le pare-brise. Les pièces roulent, tournent et percutent.",
  u3="Clinique vétérinaire : animaux à grosse tête, le personnel contre les anomalies.",
  u4="Hockey : une patinoire avec vrais marquages, bandes et tribunes. Les pièces patinent et l’échec et mat est un but.",
  h2="JOUEZ COMME VOUS VOULEZ",
  p1="Adversaire ordinateur en trois niveaux : facile, moyen et difficile. Le moteur tourne sur votre appareil.",
  p2="Deux joueurs sur un seul appareil, avec rotation facultative du plateau après chaque coup.",
  p3="En ligne via Game Center : un ami ou un adversaire au hasard, de 30 secondes à 5 minutes par coup, classement et tableaux des meilleurs.",
  p4="Les coups légaux et le dernier coup sont surlignés ; annulez un coup, retournez le plateau, abandonnez ou recommencez à tout moment.",
  h3="TOUTES LES RÈGLES DES ÉCHECS",
  rules="Roque, prise en passant, promotion au choix, échec, échec et mat, pat, triple répétition, règle des 50 coups et matériel insuffisant. Déplacez les pièces en touchant ou en faisant glisser.",
  h4="UNE CAMÉRA QUI VOUS SUIT",
  cam="Faites tourner le plateau à 360 degrés, inclinez-le, zoomez en pinçant. Un bouton caméra passe d’un angle prêt à l’autre ; en mode cinéma, les prises passent au ralenti.",
  h5="SON ET TABLEAU D’HONNEUR",
  pro_snd="Un commentateur à voix neuronale, féminine ou masculine, commente la partie dans chaque univers. Les victoires rapportent des points au tableau d’honneur de l’appareil.",
  h6="CHESSGM PRO",
  pro="Vous pouvez jouer 5 parties par jour gratuitement. Un achat unique de ChessGM Pro supprime cette limite pour toujours : sans abonnement ni publicité.",
  h7="HORS LIGNE ET PRIVÉ",
  priv="Jouer contre l’ordinateur ou à deux sur un appareil ne demande pas d’internet ; seules les parties en ligne en ont besoin. Pas de compte propre, pas de publicité, pas de suivi.",
  iface="L’interface est en anglais et en russe, selon la langue de l’appareil."),
 "it": dict(
  intro="ChessGM è la scacchiera 3D per tutta la famiglia: pezzi tridimensionali, quattro universi divertenti e mosse evidenziate che aiutano i principianti. Gioca in due sullo stesso schermo, contro il computer su tre livelli o online con Game Center. Funziona anche senza internet.",
  h1="QUATTRO UNIVERSI, QUATTRO SET DI PEZZI",
  u1="Classico: pezzi Staunton in avorio ed ebano su una scacchiera di acero e noce.",
  u2="Corse: auto da cartone animato con gli occhi sul parabrezza. I pezzi corrono, girano e speronano.",
  u3="Clinica veterinaria: animali con la testa grande, il personale contro le anomalie.",
  u4="Hockey: una pista con segni veri, balaustre e tribune. I pezzi pattinano e lo scacco matto è un gol.",
  h2="GIOCA COME VUOI",
  p1="Avversario computer su tre livelli: facile, medio e difficile. Il motore gira sul tuo dispositivo.",
  p2="Due giocatori su un solo dispositivo, con rotazione facoltativa della scacchiera dopo ogni mossa.",
  p3="Online con Game Center: un amico o un avversario a caso, da 30 secondi a 5 minuti per mossa, classifica e graduatorie.",
  p4="Mosse legali e ultima mossa evidenziate; annulla una mossa, gira la scacchiera, abbandona o ricomincia quando vuoi.",
  h3="TUTTE LE REGOLE DEGLI SCACCHI",
  rules="Arrocco, presa al varco, promozione con scelta del pezzo, scacco, scacco matto, stallo, triplice ripetizione, regola delle 50 mosse e materiale insufficiente. Muovi i pezzi toccando o trascinando.",
  h4="UNA TELECAMERA CHE TI SEGUE",
  cam="Ruota la scacchiera di 360 gradi, inclinala, ingrandisci con un pizzico. Un tasto telecamera cambia tra inquadrature pronte; in modalità cinema le catture vanno al rallentatore.",
  h5="AUDIO E ALBO D’ONORE",
  pro_snd="Un telecronista con voce neurale, femminile o maschile, commenta la partita in ogni universo. Le vittorie danno punti nell’albo d’onore del dispositivo.",
  h6="CHESSGM PRO",
  pro="Puoi giocare 5 partite al giorno gratis. Un acquisto una tantum di ChessGM Pro toglie il limite per sempre: senza abbonamento e senza pubblicità.",
  h7="SENZA INTERNET E PRIVATO",
  priv="Giocare contro il computer o in due su un dispositivo non richiede internet; solo le partite online. Nessun account nostro, nessuna pubblicità, nessun tracciamento.",
  iface="L’interfaccia è in inglese e russo, secondo la lingua del dispositivo."),
 "pt-BR": dict(
  intro="ChessGM é xadrez 3D para toda a família: peças tridimensionais, quatro universos divertidos e jogadas destacadas que ajudam os iniciantes. Jogue em dois na mesma tela, contra o computador em três níveis ou online pelo Game Center. Também funciona sem internet.",
  h1="QUATRO UNIVERSOS, QUATRO CONJUNTOS DE PEÇAS",
  u1="Clássico: peças Staunton de marfim e ébano em um tabuleiro de bordo e nogueira.",
  u2="Corrida: carrinhos de desenho com olhos no para-brisa. As peças andam, viram e batem.",
  u3="Clínica veterinária: bichinhos cabeçudos, a equipe contra as anomalias.",
  u4="Hóquei: uma pista com marcações reais, bordas e arquibancadas. As peças patinam e o xeque-mate é um gol.",
  h2="JOGUE DO SEU JEITO",
  p1="Adversário computador em três níveis: fácil, médio e difícil. O motor roda no seu aparelho.",
  p2="Dois jogadores em um só aparelho, com giro opcional do tabuleiro a cada jogada.",
  p3="Online pelo Game Center: um amigo ou um adversário aleatório, de 30 segundos a 5 minutos por jogada, ranking e placares.",
  p4="Jogadas legais e a última jogada ficam destacadas; desfaça, gire o tabuleiro, desista ou recomece quando quiser.",
  h3="TODAS AS REGRAS DO XADREZ",
  rules="Roque, en passant, promoção com escolha da peça, xeque, xeque-mate, afogamento, tripla repetição, regra dos 50 lances e material insuficiente. Mova as peças tocando ou arrastando.",
  h4="UMA CÂMERA QUE ACOMPANHA VOCÊ",
  cam="Gire o tabuleiro em 360 graus, incline e aproxime com o gesto de pinça. Um botão de câmera alterna entre ângulos prontos; no modo cinema, as capturas vão em câmera lenta.",
  h5="SOM E QUADRO DE HONRA",
  pro_snd="Um locutor com voz neural, feminina ou masculina, comenta a partida em cada universo. As vitórias dão pontos no quadro de honra do aparelho.",
  h6="CHESSGM PRO",
  pro="Você pode jogar 5 partidas por dia de graça. Uma compra única do ChessGM Pro tira o limite para sempre: sem assinatura e sem anúncios.",
  h7="SEM INTERNET E PRIVADO",
  priv="Jogar contra o computador ou em dois no mesmo aparelho não exige internet; só as partidas online. Sem contas próprias, sem anúncios e sem rastreamento.",
  iface="A interface está em inglês e russo, conforme o idioma do aparelho."),
 "pl": dict(
  intro="ChessGM to szachy 3D dla całej rodziny: prawdziwe trójwymiarowe figury, cztery wesołe światy i podświetlane ruchy, które pomagają początkującym. Graj we dwoje na jednym ekranie, z komputerem na trzech poziomach lub online przez Game Center. Działa też bez internetu.",
  h1="CZTERY ŚWIATY, CZTERY ZESTAWY FIGUR",
  u1="Klasyka: figury Staunton z kości słoniowej i hebanu na szachownicy z klonu i orzecha.",
  u2="Wyścigi: kreskówkowe autka z oczami na szybie. Figury jeżdżą, skręcają i taranują.",
  u3="Lecznica dla zwierząt: wielkogłowe zwierzaki, personel kontra anomalie.",
  u4="Hokej: lodowisko z prawdziwymi liniami, bandami i trybunami. Figury jeżdżą na łyżwach, a mat to gol.",
  h2="GRAJ PO SWOJEMU",
  p1="Komputer na trzech poziomach: łatwym, średnim i trudnym. Silnik działa na twoim urządzeniu.",
  p2="Dwóch graczy na jednym urządzeniu, z opcjonalnym obracaniem szachownicy po każdym ruchu.",
  p3="Online przez Game Center: znajomy lub losowy rywal, od 30 sekund do 5 minut na ruch, ranking i tabele wyników.",
  p4="Dozwolone ruchy i ostatni ruch są podświetlone; cofnij ruch, obróć szachownicę, poddaj się lub zacznij od nowa w każdej chwili.",
  h3="PEŁNE ZASADY SZACHÓW",
  rules="Roszada, bicie w przelocie, promocja z wyborem figury, szach, mat, pat, trzykrotne powtórzenie, reguła 50 ruchów i zbyt mały materiał. Figury przesuwasz dotykiem lub przeciągnięciem.",
  h4="KAMERA, KTÓRA CIĘ ŚLEDZI",
  cam="Obracaj szachownicę o 360 stopni, pochylaj i przybliżaj szczypnięciem. Przycisk kamery przełącza gotowe ujęcia; w trybie kinowym bicia lecą w zwolnionym tempie.",
  h5="DŹWIĘK I TABLICA HONOROWA",
  pro_snd="Lektor z neuronowym głosem, żeńskim lub męskim, komentuje partię w każdym świecie. Zwycięstwa dają punkty na tablicy honorowej urządzenia.",
  h6="CHESSGM PRO",
  pro="Za darmo można zagrać 5 partii dziennie. Jednorazowy zakup ChessGM Pro znosi limit na zawsze: bez subskrypcji i reklam.",
  h7="BEZ INTERNETU I PRYWATNIE",
  priv="Gra z komputerem lub we dwoje na jednym urządzeniu nie wymaga internetu; tylko partie online. Bez własnych kont, reklam i śledzenia.",
  iface="Interfejs jest po angielsku i rosyjsku, zależnie od języka urządzenia."),
 "uk": dict(
  intro="ChessGM — 3D-шахи для всієї родини: об’ємні фігури, чотири веселі всесвіти та підсвітка ходів, яка допомагає новачкам. Грайте вдвох на одному екрані, з комп’ютером на трьох рівнях або онлайн через Game Center. Працює й без інтернету.",
  h1="ЧОТИРИ ВСЕСВІТИ — ЧОТИРИ НАБОРИ ФІГУР",
  u1="Класика: фігури Стаунтона зі слонової кістки та ебенового дерева, дошка з клена й горіха.",
  u2="Перегони: мультяшні машинки з очима на лобовому склі. Фігури їдуть, повертають і таранять.",
  u3="Ветклініка: великоголові звірі, персонал проти аномалій.",
  u4="Хокей: льодова арена зі справжнім розміченням, бортами й трибунами. Фігури їздять на ковзанах, а мат — це гол.",
  h2="ГРАЙТЕ ЯК ЗРУЧНО",
  p1="Комп’ютер-суперник на трьох рівнях: легкий, середній і важкий. Рушій працює на пристрої.",
  p2="Гра вдвох на одному пристрої з автоповоротом дошки після кожного ходу — за бажанням.",
  p3="Онлайн через Game Center: друг або випадковий суперник, від 30 секунд до 5 хвилин на хід, рейтинг і таблиці лідерів.",
  p4="Доступні ходи та останній хід підсвічуються; скасування ходу, розворот дошки, здача й нова партія — будь-коли.",
  h3="ВСІ ПРАВИЛА ШАХІВ",
  rules="Рокіровка, взяття на проході, перетворення пішака з вибором фігури, шах, мат, пат, триразове повторення, правило 50 ходів і недостатній матеріал. Фігури рухаються дотиком або перетягуванням.",
  h4="КАМЕРА, ЯКА СЛІДУЄ ЗА ВАМИ",
  cam="Крутіть дошку на 360 градусів, нахиляйте, наближайте щипком. Кнопка камери перемикає готові ракурси; у кінорежимі взяття показуються в сповільненні.",
  h5="ЗВУК І ДОШКА ПОШАНИ",
  pro_snd="Диктор із нейроголосом, жіночим або чоловічим, коментує партію в усіх всесвітах. Перемоги приносять очки в дошку пошани на пристрої.",
  h6="CHESSGM PRO",
  pro="Безкоштовно можна зіграти 5 партій на день. Разова покупка ChessGM Pro знімає обмеження назавжди: без підписки та реклами.",
  h7="БЕЗ ІНТЕРНЕТУ І БЕЗ СТЕЖЕННЯ",
  priv="Гра з комп’ютером і вдвох на одному пристрої працює без мережі; інтернет потрібен лише для онлайн-партій. Власних акаунтів, реклами й трекінгу немає.",
  iface="Інтерфейс російською та англійською, мова обирається за налаштуваннями пристрою."),
}

# «Что нового» для новых локалей: перевод заметок 1.1 (в новых локалях страницы они ещё не показывались)
NOTES = {
 "en-GB": "Online play, announcer voices and ChessGM Pro!\n\n• Online games via Game Center: invite a friend or get a random opponent. 30 seconds to 5 minutes per move, rating, one-tap rematch.\n• A neural-voice announcer, female or male, in every universe.\n• Chess piece badges above the pieces in Racing, Vet Clinic and Hockey.\n• Captured pieces are shown under the board.\n• Landscape mode on iPhone and a camera button for ready-made angles.\n• Hall of Fame: points and winning streaks on this device.\n• ChessGM Pro: 5 free games a day, a one-time purchase removes the limit for good.",
 "es-MX": "¡Juego en línea, locutor con voz y ChessGM Pro!\n\n• Partidas en línea con Game Center: invita a un amigo o juega con un rival al azar. De 30 segundos a 5 minutos por jugada, ranking y revancha con un toque.\n• Locutor con voz neuronal, femenina o masculina, en todos los universos.\n• Símbolos de las piezas sobre las figuras en Carreras, Clínica veterinaria y Hockey.\n• Las piezas capturadas se ven bajo el tablero.\n• Modo horizontal en iPhone y botón de cámara con ángulos listos.\n• Cuadro de honor: puntos y rachas de victorias en este dispositivo.\n• ChessGM Pro: 5 partidas gratis al día; una compra única quita el límite para siempre.",
 "es-ES": "¡Juego en línea, locutor con voz y ChessGM Pro!\n\n• Partidas en línea con Game Center: invita a un amigo o juega con un rival al azar. De 30 segundos a 5 minutos por jugada, clasificación y revancha con un toque.\n• Locutor con voz neuronal, femenina o masculina, en todos los universos.\n• Símbolos de las piezas sobre las figuras en Carreras, Clínica veterinaria y Hockey.\n• Las piezas capturadas se ven bajo el tablero.\n• Modo horizontal en iPhone y botón de cámara con ángulos preparados.\n• Cuadro de honor: puntos y rachas de victorias en este dispositivo.\n• ChessGM Pro: 5 partidas gratis al día; una compra única quita el límite para siempre.",
 "de-DE": "Online-Spiel, Sprecherstimmen und ChessGM Pro!\n\n• Online-Partien über Game Center: Freund einladen oder Zufallsgegner finden. 30 Sekunden bis 5 Minuten pro Zug, Rangliste, Revanche mit einem Tipp.\n• Sprecher mit neuronaler Stimme, weiblich oder männlich, in jeder Welt.\n• Figuren-Symbole über den Figuren in Rennen, Tierklinik und Eishockey.\n• Geschlagene Figuren liegen unter dem Brett.\n• Querformat auf dem iPhone und Kamera-Knopf für fertige Perspektiven.\n• Ehrentafel: Punkte und Siegesserien auf diesem Gerät.\n• ChessGM Pro: 5 Gratis-Partien pro Tag, ein einmaliger Kauf hebt das Limit für immer auf.",
 "fr-FR": "Jeu en ligne, voix de commentateur et ChessGM Pro !\n\n• Parties en ligne via Game Center : invitez un ami ou affrontez un inconnu. De 30 secondes à 5 minutes par coup, classement, revanche en un toucher.\n• Commentateur à voix neuronale, féminine ou masculine, dans chaque univers.\n• Symboles des pièces au-dessus des figures dans Course, Clinique vétérinaire et Hockey.\n• Les pièces prises sont posées sous le plateau.\n• Mode paysage sur iPhone et bouton caméra pour des angles prêts.\n• Tableau d’honneur : points et séries de victoires sur cet appareil.\n• ChessGM Pro : 5 parties gratuites par jour, un achat unique supprime la limite pour toujours.",
 "it": "Gioco online, voci del telecronista e ChessGM Pro!\n\n• Partite online con Game Center: invita un amico o trova un avversario a caso. Da 30 secondi a 5 minuti per mossa, classifica, rivincita con un tocco.\n• Telecronista con voce neurale, femminile o maschile, in ogni universo.\n• Simboli dei pezzi sopra le figure in Corse, Clinica veterinaria e Hockey.\n• I pezzi catturati restano sotto la scacchiera.\n• Modalità orizzontale su iPhone e tasto telecamera per inquadrature pronte.\n• Albo d’onore: punti e serie di vittorie su questo dispositivo.\n• ChessGM Pro: 5 partite gratis al giorno, un acquisto una tantum toglie il limite per sempre.",
 "pt-BR": "Jogo online, voz de locutor e ChessGM Pro!\n\n• Partidas online pelo Game Center: convide um amigo ou ache um adversário aleatório. De 30 segundos a 5 minutos por jogada, ranking, revanche com um toque.\n• Locutor com voz neural, feminina ou masculina, em cada universo.\n• Símbolos das peças sobre as figuras em Corrida, Clínica veterinária e Hóquei.\n• As peças capturadas ficam sob o tabuleiro.\n• Modo paisagem no iPhone e botão de câmera com ângulos prontos.\n• Quadro de honra: pontos e sequências de vitórias neste aparelho.\n• ChessGM Pro: 5 partidas grátis por dia, uma compra única tira o limite para sempre.",
 "pl": "Gra online, głos lektora i ChessGM Pro!\n\n• Partie online przez Game Center: zaproś znajomego lub trafisz na losowego rywala. Od 30 sekund do 5 minut na ruch, ranking, rewanż jednym dotknięciem.\n• Lektor z neuronowym głosem, żeńskim lub męskim, w każdym świecie.\n• Symbole figur nad figurami w Wyścigach, Lecznicy i Hokeju.\n• Zbite figury leżą pod szachownicą.\n• Tryb poziomy na iPhonie i przycisk kamery z gotowymi ujęciami.\n• Tablica honorowa: punkty i serie zwycięstw na tym urządzeniu.\n• ChessGM Pro: 5 darmowych partii dziennie, jednorazowy zakup znosi limit na zawsze.",
 "uk": "Гра онлайн, голос диктора та ChessGM Pro!\n\n• Онлайн-партії через Game Center: запросіть друга або знайдіть випадкового суперника. Від 30 секунд до 5 хвилин на хід, рейтинг, реванш одним дотиком.\n• Диктор із нейроголосом, жіночим або чоловічим, у кожному всесвіті.\n• Значки шахових фігур над фігурами в Перегонах, Ветклініці та Хокеї.\n• Збиті фігури лежать під дошкою.\n• Горизонтальний режим на iPhone і кнопка камери з готовими ракурсами.\n• Дошка пошани: очки й серії перемог на цьому пристрої.\n• ChessGM Pro: 5 безкоштовних партій на день, разова покупка знімає обмеження назавжди.",
}


def w(loc, field, text):
    d = ROOT / loc
    d.mkdir(exist_ok=True)
    (d / f"{field}.txt").write_text(text.rstrip("\n") + "\n", encoding="utf-8")


def build_desc(d):
    return "\n\n".join([
        d["intro"],
        d["h1"] + "\n• " + "\n• ".join(d[k] for k in ("u1", "u2", "u3", "u4")),
        d["h2"] + "\n• " + "\n• ".join(d[k] for k in ("p1", "p2", "p3", "p4")),
        d["h3"] + "\n" + d["rules"],
        d["h4"] + "\n" + d["cam"],
        d["h5"] + "\n" + d["pro_snd"],
        d["h6"] + "\n" + d["pro"],
        d["h7"] + "\n" + d["priv"],
        d["iface"],
    ])


def main():
    en = ROOT / "en-US"
    for loc, m in META.items():
        for f, k in (("name", "name"), ("subtitle", "subtitle"), ("keywords", "keywords"), ("promotional_text", "promo")):
            w(loc, f, m[k])
        if loc in INTRO:
            p = ROOT / loc / "description.txt"
            parts = p.read_text(encoding="utf-8").strip().split("\n\n")
            parts[0] = INTRO[loc]
            w(loc, "description", "\n\n".join(parts))
        else:
            w(loc, "description", build_desc(D[loc]))
            w(loc, "release_notes", NOTES[loc])
            for f in ("support_url", "privacy_url"):
                w(loc, f, (en / f"{f}.txt").read_text(encoding="utf-8"))
    print("готово:", ", ".join(META))


if __name__ == "__main__":
    main()
