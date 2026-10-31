# Nastavak Tripore na ovom ili novom laptopu

Aktualno: sva četiri provider računa su registrirana, Neon je konfiguriran, Brevo telefon/sender potvrđeni. Korisnik je repozitorij učinio javnim i izričito odobrio commit/push svih trenutnih promjena s engleskim opisom. Izvor za Render je **codex/offline-foundation**; još nema stvarnog deploymenta ni povezanih tajni. Korisnik povezuje repozitorij u Renderu. Aktualni dokaz i sljedeći korak: [STATUS](STATUS.md).

Aktualno 2026-10-31 — korisnik je odobrio i implementirani su pretraga mjesta po nazivu/gradu, odabir rezultata, koordinate kroz offline sync i native MapLibre karta. Prolaze 83 mobilna / 48 HTTP scenarija te QA10 Android build; APK nije instaliran/fizički prihvaćen. Zahtjev je 0 € bez bankovne kartice i bez laptopa: pripremljen Render/Neon/Cloudinary/Brevo; korisnik nema račune i tražio je [korake registracije](NO_CARD_SETUP.md). Nema stvarnog deploymenta. [Odluka 0005](decisions/0005-maps-and-no-card-beta.md) i [STATUS](STATUS.md) zamjenjuju raniji research-only/Supabase checkpoint.

Aktualno 2026-10-31: plava #0593C6 / svijetla #FCFFFF / ružičasta #D83995 zamjenjuju staru paletu. Lokalni razvojni i QA HTTPS API ponovno pokrenuti nakon provjere zaostale brave; JSON timeout obuhvaća tijelo odgovora i dopušta 75 s za buđenje. [Promjene i dokazi](DESIGN_CONNECTION_2026-10-31.md), [istraživanje karte bez implementacije](MAP_RESEARCH.md), [aktualni status](STATUS.md). Nova tema još nije instalirana/fizički prihvaćena na telefonu. Cloud deployment ostaje otvoren; nema obećanja stalne dostupnosti Free hostinga.

Ažurirano: 2026-10-30. Aktualno stanje i dokaz provjera: [STATUS.md](STATUS.md).
Razvojna grana: `codex/offline-foundation`; main još sadrži početnu dokumentaciju.

## Aktualni nastavak — besplatna beta i računi

Prvo pročitati [release faze](RELEASE_PHASES.md), [odluku 0004](decisions/0004-free-beta-and-account-lifecycle.md) i [pripremu servisa](FREE_BETA_SETUP.md). Korisnik je odobrio Render/Supabase/Brevo Free, email potvrdu/reset i brisanje vlastitih putovanja plus vlastitih zapisa u tuđima. Implementacija i lokalni testovi su pripremljeni: 77 mobilnih / 43 HTTP scenarija, lokalni Linux kontejner 512 MiB, 0 high/critical i 8 low dependency nalaza. QA9 s ikonom kofera/aviona instaliran je na Android uz očuvane podatke. iPhone je odgođen.

Cloud računi/tajne, stvarna email dostava, internetski deployment i zajednički hosted backup/povrat još nisu dovršeni. Ne objavljivati stari main ili tajne; nema autorizacije za commit/push. Aktualni razvojni/QA procesi i ignorirani certifikati opisani su u STATUS; starije brojke i otvoreni izbor providera u nastavku predstavljaju povijest.

## Pročitati prije nastavka

AGENTS.md, PRD.md, Architecture-essentials.md, Architecture.md,
[auth/sync odluku](decisions/0001-auth-sync.md), [checklistu](AUTH_SYNC_CHECKLIST.md)
i [plan razvoja](TRIPORA_PLAN.md). Repo je samostalan; ne prenositi legacy roditeljski projekt.

## Redizajn 2026-10-23

Globalno Putovanja/Sinkronizacija/Račun; unutar putovanja Pregled/Plan/Mjesta/Troškovi/Više. Forme i detalji su odvojeni native modali, a datum/vrijeme biraju se izvornim kontrolama. Raspberry/pale-sky tema i zajedničke komponente su u apps/mobile/src/ui. Baza/API/sync ugovori ostaju isti. [UX_REDESIGN.md](UX_REDESIGN.md) opisuje promjene, dokaze i šest ručnih scenarija. Korisnik je potvrdio pokretanje prethodne verzije na Androidu nakon instalacije Expo Go za SDK 57; ovaj redizajn još treba fizički pregledati.

## Što sada radi

- App.tsx: registracija/prijava, obnova sesije, baza pojedinog računa i offline create/list/update/delete putovanja.
- SecureStore adapter sprema sesiju; odjava traži potvrdu i čuva neposlane promjene za isti račun.
- Mobilni outbox i serverski Identity/PostgreSQL API su povezani.
- Sinkronizacija na prijavi/restoreu, lokalnoj promjeni, foreground resumeu, ručno i foreground retry svakih 30 sekundi.
- Konflikt prikazuje obje verzije i traži potvrdu serverskog/lokalnog izbora. Serversko brisanje se ne oživljava.
- Vlasnik izdaje/opoziva kodove pozivnica i uklanja članove. Pozvani registrirani račun prihvaća online i preuzima putovanje; član zasad pregledava osnovne podatke.
- Opozvan pristup označava lokalnu kopiju i zaustavlja slanje uz očuvanje reda; novi kod potreban je za ponovni pristup.
- Mjesta/Hrana/Izlasci: odvojeni prikazi, zajednički model, unos/uređivanje/brisanje, bilješke/adresa/poveznica, posjećenost i filtri za vlasnika i aktivnog člana.
- SQLite v3 čuva stare podatke, offline nacrte i nepromjenjivi red; uzastopne izmjene idu kao nova operacija nakon potvrde prethodne. Pripremi za offline potvrđuje tek dovršeno preuzimanje svih metapodataka; fotografije se preuzimaju posebno.
- Testovi: 71 mobilnih i 35 PostgreSQL/HTTP scenarija, uključujući mjesta, offline red, konflikte, ovlasti, prekide i restart. Nastavak 2026-10-23 dodaje devet regresija sesije: zakašnjela obnova/HTTP odgovori ne smiju prijeći u novi račun niti poništiti odjavu.
- Korisnik je potvrdio pokretanje prethodne verzije na fizičkom Androidu s Expo Go za SDK 57. Redizajn, native SecureStore/SQLite offline restart, galerija i iPhone još trebaju puni prihvat.

## Instalacija i provjere

Node 22.13+ i .NET 10 SDK. Na ovom Windowsu po potrebi koristiti C:/Program Files/nodejs/npm.cmd.

```sh
npm ci --prefix apps/mobile
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
npm run export:android --prefix apps/mobile
npm run export:ios --prefix apps/mobile
dotnet build services/api/Tripora.Api.csproj --configuration Release
node tests/e2e/api-health.mjs
npm ci --prefix tests/e2e
node --experimental-sqlite tests/e2e/auth-sync.mjs
```

Integracijski test sam pokreće izolirani PostgreSQL s generiranim vjerodajnicama i sintetičkim računima,
a zatim ga zaustavlja i uklanja samo svoju testnu mapu. Nije potreban Docker.

## Pokretanje aplikacije i link

Nakon instalacije i builda:

```sh
node tests/e2e/dev.mjs
```

Runner pokreće trajnu razvojnu bazu na loopback portu 55433, API na 5080 i Expo na 8081.
Ispisuje Android/iPhone HTTP launcher linkove i exp:// link; sprema ih i u ignored local-data/development/links.json.
Mobitel mora biti na istoj pouzdanoj mreži, uz kompatibilan Expo Go. Računalo mora ostati uključeno.
Ako postoji više mrežnih sučelja, postaviti TRIPORA_DEV_HOST na lokalnu IPv4 adresu računala.
Registrirati probni račun; nema unaprijed zadane lozinke. Ctrl+C zaustavlja runner, podaci i privatne fotografije ostaju u local-data/development.
Pozadinska instanca pokrenuta iz Codexa nije trajni hosting: nakon restarta ponovno pokrenuti gornju naredbu.

Za zaseban API postaviti EXPO_PUBLIC_API_URL prije npm start. Zadani 127.0.0.1 nije adresa laptopa iz perspektive mobitela.
API je razvojni; javni deployment nije spreman. Email confirmation/recovery nije konfiguriran.

## QA 2026-10-25

Puni dostupni automatizirani krug prolazi: 71 mobilni test, 35 HTTP/PostgreSQL scenarija, backup guard i oba izvoza. Ispravljeni su UI odabir valute nakon obrisanih troškova i neobrađena greška native dijeljenja pozivnice. [QA izvještaj](QA_REPORT_2026-10-25.md) navodi dokaz za svaku funkcionalnost i preostali native prihvat. Nema dostupnog ADB/Android SDK-a ni iOS simulatora na ovom računalu; fizičko testiranje nije proglašeno dovršenim.

## Sljedeći korak

**Najnovije — završni Android krug 2026-10-29:** na korisnikov zahtjev dovršen je dostupan Samsung krug, uz izričito odgođen današnji iPhone. Članski trošak prenesen jednom; konflikti/restart/oba izbora i serversko brisanje prolaze. Simulirani manjak prostora čuva tekst; normalni QA7 potom potvrđuje WebP/HEIC, privatni upload i offline trajnost nakon uklanjanja testnih izvornika. Veliki tekst i osnovni aktivni TalkBack/form fokus provjereni; postavke i lokalna mrežna dozvola vraćene. Fizički puni disk, stvarni LAN denial i potpuni accessibility audit nisu proglašeni provjerenima. [Točna matrica, SHA i granice](ANDROID_ACCEPTANCE_2026-10-29.md). Slijede četiri high dependency nalaza i priprema account recovery/HTTPS privatne distribucije; iPhone/dva uređaja kad budu dostupni. Starije upute o neposlanom trošku i ranijim pauzama ispod više nisu aktualne.

**Aktualno 2026-10-29:** EXIF priprema i oporavak stare prevelike fotografije dovršeni su i fizički potvrđeni u QA5. Stara nepromjenjiva referenca prenesena je pod istim ID-em; red se ispraznio, jedna uspomena ostala je očuvana, privatne kopije 800×1280 / 200×320 preživjele su cold start bez API-ja i uklanjanje današnjeg sintetičkog izvornika. Prolaze 73 mobilna testa, oba izvoza, API build/liveness, backup guard i svih 35 integracijskih scenarija. Postavke su očitane kao stay-awake=0, airplane=0, font=1.15; vraćen je izravni adb reverse 5443→5443. QA build mora koristiti https://localhost:5443 prema postojećem trust profilu i računskom scopeu; provjeriti ugrađeni endpoint jer Gradle ne prati promjenu environment varijable. Sljedeće je ponovno prijaviti člana i prenijeti njegov sačuvani trošak 12,34 EUR, zatim ostatak native matrice/iPhone i priprema distribucije. [Dokaz i završni SHA](ANDROID_MEDIA_RECOVERY_2026-10-29.md). Stariji stop checkpointi ispod ostaju povijest.

Povrat postavki pri zadnjem zaustavljanju NIJE potvrđen: ADB više nije vidio telefon. Posljednje potvrđeno: font 1.15, airplane mode 0; privremeni USB stay-awake bio je uključen. Pri nastavku prvo vratiti spremljeni stay-awake baseline iz ignored local-data/native-qa-tls/stay-awake-baseline.txt i izravni QA USB forward 5443→5443. Ne nastavljati phone UI rad dok korisnik ne zatraži nastavak.

**Najnovije: korisnik je zaustavio rad do kasnijeg nastavka.** QA3 packing popravak fizički potvrđen na fontovima 1.15/1.5; opozvana sesija i uklonjeni član s redom te povrat pristupa prolaze. Članski offline trošak 12,34 EUR ostaje lokalno neposlan nakon odjave; vlasnička prijava ga nije poslala. Native restoran spremljen. Otkriven novi EXIF bug: rotirani JPEG pripremljen kao 1280×2048 / 320×512 pa server vraća 400. Kod prelazi na dekodirane dimenzije, regresija reproducira stari kvar i prolazi nakon popravka; 71 test prolazi. QA4 build/export/auth-sync pokrenuti su prije zaustavljanja — prvo očitati qa4 logove; QA4 nije instaliran/fizički potvrđen. Prethodno prevelika JPEG kopija ostaje u vlasnikovu redu i traži siguran oporavak; ne proglašavati taj tok gotovim niti brisati lokalni rad. [Aktualni status](STATUS.md).

Najnoviji nastavak: korisnik je odobrio nastavak nakon pauze. Pronađena je i kodom popravljena fizička packing layout greška; 71 test, TypeScript, oba izvoza i QA3 build prolaze. USB se ponovno izgubio prije instalacije. **Prvo ponovno spojiti uređaj i instalirati QA3; fizički prihvat popravka još PENDING.** Sintetički član ima neposlanu packing stavku i opozvanu sesiju; dovršiti lokalni nastavak/ponovnu prijavu pa ostatak matrice. [Aktualni checkpoint i SHA](ANDROID_DEVICE_QA_2026-10-28.md). Font/dozvole/radio nisu mijenjani u ovom nastavku.

Aktualno: korisnik je izričito pauzirao testove jer treba koristiti telefon. Nakon prethodnog reconnecta potvrđeni su vraćen airplane mode, QA2 upgrade s neposlanim redom, uspješan upload retry, drugi račun i native offline download/cold start te prekinuti download/retry. [Trenutačni checkpoint](ANDROID_DEVICE_QA_2026-10-28.md). Prvo dobiti korisnikov nastavak; zatim sesije/uklonjeni član s lokalnim radom, packing/plan/troškovi i preostale sigurne device provjere. Izvorni QA USB forward vraćen pri pauzi; nema daljnjeg UI upravljanja.

Aktualni prekid rada: [prošireni Android test](ANDROID_DEVICE_QA_2026-10-28.md) potvrdio je prekid aktivnog uploada i hladni start s redom u stvarnom airplane modeu, ali USB veza se zatim izgubila. Prvo ponovno spojiti uređaj i vratiti airplane mode na početno isključeno stanje; vraćanje još nije potvrđeno. QA2 nadogradnja s neposlanim podacima je izrađena, ali nije instalirana. Slijede retry i drugi sintetički račun/native download te ostatak matrice. Nema izmjene aplikacijskog izvora.

Nastavak 2026-10-28: na istom Samsung QA buildu potvrđeni su stvarni picker (odabir/odustajanje), sintetička PNG uspomena bez API-ja, uklanjanje samo testnog izvornika, puna slika nakon cold starta te prijenos i privatni serverski pristup bez duplikata. [Foto dokaz i granice](ANDROID_PHOTO_QA_2026-10-28.md). Nije mijenjan aplikacijski kod. Sljedeće su prekid aktivnog uploada/ponovni pokušaj i native offline preuzimanje na drugom sintetičkom računu, zatim odbijene dozvole i ostatak beta matrice. Razvojni runner sada koristi loopback linkove za USB QA; HTTPS API i USB forward rade. Puni automatizirani skup/build/audit nije ponavljan za ovaj device-only korak.

Nastavak 2026-10-27: Samsung instalirani QA paket potvrdio je registraciju, native datume, putovanja, hladni start bez dostupnog API-ja, trajni offline red i ponovno slanje bez duplikata. Ispravljen je gubitak nacrta pri zatvaranju Samsung tipkovnice; fizička regresija i 71 mobilni test prolaze, kao i oba izvoza. [Dokazi i build](ANDROID_QA_2026-10-27.md). Sljedeće je Android galerija/fotografija i njezina offline trajnost, zatim ostatak device matrice i iPhone. Airplane mode, fotografije i puna beta nisu proglašeni provjerenima. Današnji npm ci prijavljuje 4 high nalaza; ostaju otvoreni.

Implementirani su dnevni plan, osobni packing (potvrda korisnika), točni troškovi/budžet i tekst/foto uspomene. Razvojna priprema faze 9 je provedena: pregled putovanja, storage/session popravci i provjeren backup/povrat baze, fotografija i ključeva. Sljedeće su fizičke beta provjere i odabir beta distribucije.
Provjeriti native hladno pokretanje/airplane mode, dozvole i manjak prostora, sigurnost te zajednički backup/povrat baze i fotografija. Potom faza 10: distribucija i održavanje. [Membership checklist](MEMBERSHIP_CHECKLIST.md) dokumentira dovršenu razvojnu cjelinu i otvorenu device provjeru.
Prije javnog izdanja riješiti auth recovery, preostale dependency nalaze i provjeru fizičkih uređaja.
Fotografije su u privatnoj razvojnoj lokalnoj pohrani; cloud hosting, produkcijski storage i povezani troškovi još nisu odabrani.

Ne počinjati iznova i ne migrirati tripora-prototype.db u korisnički račun bez eksplicitne odluke.
Places/offline dokazi: [PLACES_OFFLINE_CHECKLIST.md](PLACES_OFFLINE_CHECKLIST.md). Nova implementacija još nije commitana ni pushana.

Faze 6–8 i ograničenja provjera: [PHASES_6_8_CHECKLIST.md](PHASES_6_8_CHECKLIST.md). Expo image-picker/file-system/manipulator dodani su u lockfile. Build/exporti nisu test fizičkih uređaja.

Upute za fazu 9: [PRIVATE_BETA.md](PRIVATE_BETA.md). Upravljano gašenje: node tests/e2e/dev-stop.mjs. Backup samo nakon urednog gašenja; restore u novu local-data mapu, TRIPORA_DEV_DATA bira vraćenu kopiju. development.lock je zajednička brava; ne brisati je dok procesi rade. Prvi prijelaz na eksplicitni KeyRoot može zahtijevati ponovnu prijavu.
