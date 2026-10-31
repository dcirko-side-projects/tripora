# Android — EXIF i oporavak neposlane fotografije

Datum: 2026-10-29. Nastavak [prethodnog checkpointa](ANDROID_DEVICE_QA_2026-10-28.md).

## Kriteriji prihvata

- Sačuvati postojeću sintetičku uspomenu, tekst i nepromjenjive operacije, uključujući ranije pripremljenu preveliku fotografiju.
- Pripremiti rotirani JPEG unutar 1280 px / 320 px i potvrditi privatni upload bez duplikata.
- Sačuvati valjanu lokalnu kopiju kad priprema, pohrana ili mreža zakažu; ponoviti s istim ID-em nakon restarta.
- Vratiti privremene postavke telefona; ne proglasiti cijelu Android/iPhone betu dovršenom.

## Implementacija

Priprema koristi dekodirane dimenzije nakon EXIF rotacije. Sam odabir nove slike ne rješava raniji kvar: nepromjenjiva početna operacija još referencira staru preveliku sliku. Oporavak zato nakon 400/invalid_media provjerava hashove i PNG zaglavlja lokalne slike/minijature, te samo prevelike pending kopije ponovno priprema na novim trajnim putanjama. ID medija i entry outbox ostaju isti. Nova media metadata sprema se prije retryja; stare datoteke ostaju evidentirane u recoveryCopies do redovnog zaštićenog čišćenja. Nema migracije sheme ni promjene API-ja. Već potvrđeni/preuzeti mediji, druge greške i valjane dimenzije ne pokreću oporavak.

## Automatizirani dokaz

- Čisti mobilni npm ci, TypeScript i svih 73 testova prolaze. Dvije nove regresije pokrivaju očuvanje operacija, izgubljenu potvrdu, restart, zabranu popravka potvrđenih medija/drugih grešaka i rollback pri grešci pohrane. Native adapter test provjerava dekodirane dimenzije, stvarna PNG zaglavlja, hashove i čuvanje izvornika.
- Android/iOS Expo izvozi prolaze. Release API build, HTTP liveness, zasebni backup guard te svih 35 PostgreSQL/HTTP scenarija prolaze; integracija je ponovljena nakon promjene reda i čistog e2e npm ci.
- Prethodni QA4 logovi potvrđuju uspješan build/oba izvoza/71 test. Njegova integracija stala je na globalnoj backup bravi dok je razvojni runner radio. Današnji puni prolaz ostvaren je uz zaustavljen stack; zaštita nije uklonjena.
- Mobilna instalacija prijavljuje 6 low i 4 high dependency nalaza; e2e instalacija 0. Nema tvrdnje da su nalazi riješeni.

## Fizički dokaz i granice

USB je nakon korisnikove potvrde autoriziran. Očitan je povrat stay-awake=0, airplane=0 i font=1.15. QA4 nadogradnja uspjela je i sačuvala dvije pending stavke. Postojeća uspomena QA-jpeg-exif otvorena je kroz uređivanje i isti sintetički EXIF JPEG ponovno odabran; naslov sačuvan. To je reproduciralo potrebu za oporavkom stare reference u nepromjenjivoj operaciji.

QA5 prvi lokalni build pogrešno je koristio 127.0.0.1 umjesto localhost koji je jedini dopušten postojećim QA trust profilom; prikaz prijave i mrežna greška nisu bili gubitak podataka. Ispravak je ograničen na ignored QA build konfiguraciju. Gradle nije prepoznao promjenu environment varijable kao ulaz pa je eksplicitno ponovno generiran JS bundle; ugrađeni endpoint provjeren je prije instalacije.

- **PASS — QA5 nadogradnja/oporavak:** `adb install -r` vratio je Success; versionCode=5 / versionName=0.1.0-qa5. Vratili su se izvorna sesija i lokalni red. Dvije pending stavke ispraznile su se na nulu. APK SHA-256: `b713c3e0c2b0a8b2ac454fe546d491c5be89dd917b7205b3345c7fd19b679a3c`. Promijenjene izvorne datoteke odgovaraju QA kopiji; ovo je build iz necommitanog stabla.
- **PASS — stara nepromjenjiva referenca:** dijagnostika je zabilježila isti ID `10b9617a-75f3-408a-bdb2-10c966f4cc07` prvo kao 1280×2048 / 320×512, zatim kao 800×1280 / 200×320. ID nije zamijenjen; njegovo slanje omogućilo je potvrdu početne operacije i nastavak prema novoj odabranoj fotografiji.
- **PASS — konačni zapis/privatnost:** API pull vraća točno jednu živu uspomenu QA-jpeg-exif s novom odabranom fotografijom `41efee87-eb82-495e-8084-a2adb64ba270`, 800×1280 / 200×320. Hashovi odgovaraju bajtovima, odgovori su private/no-store, anonimni pristup daje 401, nečlan 404. Obje PNG kopije nemaju eXIf ni tEXt chunkove; to je dokaz za ovu sintetičku JPEG/EXIF/GPS datoteku, ne za sve kodeke.
- **PASS — trajnost:** uklonjena je samo današnja sintetička picker kopija Tripora-QA4-oriented.jpg. Nakon uklanjanja USB API tunela, force-stopa i hladnog otvaranja puna fotografija i sačuvan naslov vidljivi su u native aplikaciji; screenshot je vizualno pregledan. To je nedostupan API, bez promjene airplane modea. Nakon povratka izravnog tunela API provjera i dalje vraća jednu uspomenu.
- **PASS — završne postavke:** izravni `adb reverse tcp:5443 tcp:5443`, stay-awake=0, airplane=0 i font=1.15 potvrđeni su očitanjem. U ovom nastavku nisu mijenjane dozvole ni font. Razvojni runner i privatni HTTPS QA API vraćeni su nakon integracijskog testa.

Privatni dokazi: qa5-build.log, qa5-tests.log, qa5-auth-sync.log, qa5-android-export.log, qa5-ios-export.log, qa5-jpeg-verification.json, qa5-recovered-queue.json, qa5-jpeg-offline-reopened.json/png i media-dimensions.jsonl u local-data/native-qa-tls.

Sljedeće: ponovno prijaviti sintetičkog člana i potvrditi slanje ranije sačuvanog troška 12,34 EUR; zatim završiti preostale native konflikte/pristupačnost/dozvole i kontrolirani test manjka prostora. iPhone/dva uređaja i beta distribucija ostaju zasebni uvjeti.

Izvori, APK-ovi, vjerodajnice, screenshotovi i logovi ostaju u ignored local-data. Nema commita/pusha ni odabira produkcijske infrastrukture. iPhone, dva fizička uređaja, preostala beta matrica i distribucija ostaju otvoreni.
