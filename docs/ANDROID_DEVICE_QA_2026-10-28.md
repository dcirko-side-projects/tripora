# Android — prekinuti upload i nastavak device matrice

## Aktualni stop checkpoint

Korisnik je na kraju izričito zatražio zaustavljanje do kasnijeg nastavka. QA3 packing popravak je fizički potvrđen na fontovima 1.15 i 1.5, edit gumb radi. Oporavak opozvane sesije i privatnost packing stavke potvrđeni su; uklonjeni član zadržava offline plan preko restarta, server ga ne prima, a nova pozivnica omogućuje slanje jednom. Native plan ima 27. 10. 2026. / 09:00 / Prijevoz. Native restoran u kategoriji Hrana/Posjećeno spremljen je. Offline članski trošak 12,34 EUR prikazuje 987,66 EUR preostalog budžeta, a odjava ga čuva. Prijava vlasnika ne šalje članski red; trošak još nije prenesen dok se član ponovno ne prijavi.

JPEG s generiranom EXIF orijentacijom 6 i izmišljenim GPS koordinatama pokazao je stvarni kvar: slika je vizualno pravilno okrenuta, ali lokalno pripremljena na 1280×2048 i minijatura 320×512; upload odbijen HTTP 400. U nativeMedia.ts priprema sada koristi dimenzije dekodirane slike prije resizea. Regresija sa starim kodom daje točno te pogrešne dimenzije, a s popravkom 800×1280 i 200×320. Svih 71 mobilnih testova prolazi. QA4 build/export/auth-sync logove treba pregledati po nastavku; QA4 nije instaliran/fizički potvrđen. Ranije pripremljen preveliki JPEG ostaje u vlasnikovu redu; osigurati oporavak tog reda bez gubitka rada prije završnog prihvata.

Pokušaj povrata postavki pri zaustavljanju nije uspio jer ADB više ne vidi telefon. Posljednje potvrđeno stanje je font 1.15 i airplane mode 0; povrat privremenog USB stay-awake na spremljeni baseline i izravnog QA USB forwarda je PENDING. To je prvi korak pri korisnikovu nastavku. Nema daljnjeg upravljanja telefonom nakon zaustavljanja. Stariji odjeljci ispod su povijest i ne određuju aktualni checkpoint.

Datum: 2026-10-28. Nastavak nakon [osnovnog foto prihvata](ANDROID_PHOTO_QA_2026-10-28.md). Korisnik je zatražio dovršetak svih potrebnih provjera na svojem telefonu i nakon kraće pauze ponovno odobrio nastavak. **Aktualno: ADB ponovno nema uređaj; zatraženo je ponovno USB povezivanje.** Puni Android prihvat nije dovršen.

## Najnoviji nastavak — packing popravak i opozvana sesija

- Native offline unos `QA-member-private` prošao je pod sintetičkim članom. UI potvrđuje jednu packing stavku i 1 promjenu na čekanju.
- Na fizičkom ekranu pronađena je UX greška: gumb `Uredi {puni naslov}` uz checkbox trošio je širinu retka pa su naslov i status bili prelomljeni u izrazito uski stupac. Screenshot prije popravka ostaje u ignored local-data.
- U aplikacijskom `PackingPanel` edit akcija sada je kompaktni gumb s ikonom, dodirnom površinom najmanje 48 × 48 i punim `Uredi {naslov}` accessibilityLabelom. Postojeći toggle/edit handleri i pravila pristupa ostaju isti. **Fizički prikaz nakon popravka još nije potvrđen jer se USB odspojio.**
- Sintetička sesija člana opozvana je kroz API dok je packing ostao neposlan. Po vraćenoj vezi native app prikazuje obnovu prijave i poruku da je lokalni rad sačuvan. Potvrda samog retka nakon „Nastavi s lokalnim podacima” i potpuni oporavak prijave još su PENDING: USB je prekinut prije te akcije.
- Čista mobilna instalacija, TypeScript, svih 71 mobilnih testova te Android/iOS izvozi prolaze. Posljednji npm ci prijavljuje 6 low + 4 high dependency nalaza. API integracijski skup nije ponavljan za promjenu packing prikaza.
- QA3 `assembleRelease` prolazi (383 zadatka; 317 izvršeno, 66 up-to-date). Paket versionCode 3 / versionName 0.1.0-qa3, SHA-256 `faab8ea0b392a6ce48291aa4e0824458cf0c711bac56cc30084d655a97a11277`. **Još nije instaliran.** Promijenjen QA izvor odgovara promjeni aplikacijskog packing prikaza.
- Nisu mijenjani font, dozvole ili radio postavke u ovom nastavku. Posljednje potvrđene početne vrijednosti ostaju airplane=0 i font_scale=1.15. QA USB forward prije gubitka veze bio je izvorni 5443 → 5443.

Prvi korak po ponovnom povezivanju: instalirati QA3 bez brisanja podataka, provjeriti sačuvani red kroz obnovu sesije i čitljiv packing prikaz na standardnom/većem fontu, zatim ostatak matrice. Nema commita/pusha.

## Dovršeno nakon ponovnog povezivanja

- **PASS — povrat mreže:** airplane_mode_on vraćen je i očitan kao 0.
- **PASS — stvarna nadogradnja:** `adb install -r` QA2 paketa vratio je Success; Android potvrđuje versionCode=2 / versionName=0.1.0-qa2. Sesija i dvije neposlane stavke preživjele su nadogradnju i cold start. DB shema nije mijenjana, pa ovo nije nova provjera migracije sheme.
- **PASS — upload retry:** nakon vraćene API veze red je pao na 0, bez stavki koje traže pažnju. Neovisni API pull potvrđuje istu uspomenu, isti entry ID i novu uspješno prenesenu fotografiju, bez dupliciranja uspomene.
- **PASS — drugi račun:** stvarna odjava vlasnika i prijava sintetičkog člana na istom telefonu. Član vidi samo njemu dostupno putovanje. Lozinke nisu zapisivane u izlaze; vjerodajnice ostaju u ignored local-data.
- **PASS — izričiti native download:** član prije odabira vidi „Fotografija nije preuzeta na ovaj uređaj”. Nakon akcije vidi „Fotografija je preuzeta za offline”. Uz uklonjen QA API forward i force-stop/cold start slika je i dalje vidljiva; screenshot je vizualno provjeren. To su dva računa na jednom fizičkom uređaju, ne dva fizička uređaja.
- **PASS — prekinuti download i retry:** testni proxy prekida početak JSON odgovora veće druge fotografije nakon 10 bajtova. Native aplikacija prikazuje grešku odgovora i zadržava stanje nepreuzete slike. Nakon isključenja testnog kvara ponovljeno preuzimanje uspijeva. Proxyjev odgovor koristi streaming bez Content-Length; nije iz tog loga izvedena ukupna veličina odgovora.
- Tijekom rada bilo je prekida USB autorizacije i korisnikova prebacivanja u druge aplikacije. Ti pokušaji nisu brojeni kao proizvodne greške. Pomoćna skripta odbija akcije kad QA nije u prvom planu.

## Prethodna korisnikova pauza — povijesni zapis

Korisnik je odgovorio „Trebam ga sada koristiti — pauziraj”. Nema daljnjih UI radnji na telefonu. Pri pauzi vraćen je izvorni QA USB forward tcp:5443 → tcp:5443. Airplane mode i font nisu dalje mijenjani (početni font_scale=1.15). Oba lokalna fault režima postavljena su na normal tijekom uspješnih retry provjera.

Korisnik je nakon ove pauze ponovno odobrio nastavak. Najnoviji checkpoint i preostale provjere navedeni su na vrhu ovog dokumenta.

## Potvrđeno na Samsungu

- **PASS — prekid aktivnog uploada.** Lokalni HTTPS fault proxy prima stvarni upload veće sintetičke slike iz instalirane aplikacije. Zahtjev ima Content-Length 4.235.566 bajtova; veza je namjerno prekinuta nakon primljenih 8.192–57.344 bajtova, prije prosljeđivanja API-ju. Aplikacija zadržava novu sliku i dvije stavke na čekanju te prikazuje potrebu za pažnjom. Podaci nisu označeni kao sinkronizirani.
- **PASS — airplane mode i hladni start s redom.** Na uređaju je potvrđeno airplane_mode_on=1, a QA USB API forwarding je uklonjen. Nakon force-stop/cold starta sesija i dvije stavke na čekanju ostaju dostupne.
- **Prvi fault pokušaj nije brojen.** Postojeća keep-alive veza zaobišla je novi USB forward pa je početni upload prošao. Nakon force-stopa aplikacije fault proxy je stvarno prekinuo novi zahtjev za zamjenu slike; gore navedeni bajtovi pripadaju tom valjanom pokušaju.
- Drugi sintetički račun pripremljen je i dobio pristup testnom putovanju putem stvarne API pozivnice/prihvata. Prijava tog računa na telefonu i native download još nisu provedeni.
- Instalirani paket ne traži READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE; galerija koristi sustavski picker. Odbijanje nepostojeće opće galerijske dozvole nije primjenjiv test tog paketa. QA ima ACCESS_LOCAL_NETWORK dozvolu; njezino odbijanje još nije provjereno.

## Build nadogradnje

Izolirani QA projekt ima versionCode 2 / versionName 0.1.0-qa2, isti aplikacijski izvor, shemu i razvojni potpis. `assembleRelease` prolazi: 383 zadatka, 24 izvršena, 359 up-to-date. APK SHA-256: `7cfb87d5afbd36071e4db3436f358dd61d215e5f776bdb77c9a1cd07c23a99c1`.

Stvarna nadogradnja 1 → 2 uz neposlani upload naknadno je instalirana i prošla. Ne predstavlja provjeru promjene DB sheme, jer shema ostaje ista. Izvorni QA1 APK sačuvan je privatno u ignored local-data.

## Raniji prekid USB veze — povijesni zapis

ADB je nakon uspješnog airplane-mode cold starta prestao prikazivati uređaj. Korisniku je poslan zahtjev da ponovno spoji i otključa telefon; ako mu mreža treba odmah, može ručno isključiti airplane mode.

Pri prvom prekidu airplane mode bio je uključen i nije bilo QA USB API forwarda. Nakon korisnikova ponovnog povezivanja airplane mode vraćen je na 0; to je potvrđeno očitanjem. Početno stanje sačuvano je privatno: airplane_mode_on=0, font_scale=1.15, QA USB forward tcp:5443 → tcp:5443. Font i dozvole nisu mijenjani.

Lokalni fault proxyji na loopbacku 5444/5445 korišteni su samo za kontrolirane prekide. Režimi su vraćeni na normal, a izvorni QA HTTPS API/USB forward koriste 5443.

## Preostalo za ovaj uređaj

1. Ponovno povezati USB; korisnik je već odobrio nastavak. Instalirati QA3 i dovršiti fizički prihvat popravka te oporavak opozvane sesije s neposlanim packingom.
2. Dovršeni su QA2 upgrade, upload retry i drugi račun/native offline download; ne ponavljati ih bez novog razloga.
4. Provjeriti lokalne promjene, odjavu/prijavu istog i drugog računa, osobni packing, sesiju koja je opozvana, uklonjenog člana i očuvanje odbijenog reda.
5. Native plan/troškovi/datumi/navigacija, veliki tekst, tipkovnica i dostupna pristupačnost; sve promijenjene postavke vratiti.
6. Ostali podržani kodeci i prekid preuzimanja. Stvarni manjak prostora ne izazivati popunjavanjem osobnog telefona; taj zahtjev ostaje za kontrolirani testni uređaj ili sigurnu reproducibilnu simulaciju.

Nema izmjene aplikacijskog koda ili produkcijskih infrastrukturnih odluka. Promijenjena je samo ignored QA native verzija i testne skripte. Puni mobilni/API automatizirani skup, dependency audit i iOS build nisu ponavljani. Nema commita/pusha. iPhone i stvarni rad na dva fizička uređaja ostaju zasebni uvjeti bete.
