# Tripora — UX/UI redizajn

Aktualno 2026-10-31: plava #0593C6 / svijetla #FCFFFF / ružičasta #D83995 zamjenjuju staru paletu. Lokalni razvojni i QA HTTPS API ponovno pokrenuti nakon provjere zaostale brave; JSON timeout obuhvaća tijelo odgovora i dopušta 75 s za buđenje. [Promjene i dokazi](DESIGN_CONNECTION_2026-10-31.md), [istraživanje karte bez implementacije](MAP_RESEARCH.md), [aktualni status](STATUS.md). Nova tema još nije instalirana/fizički prihvaćena na telefonu. Cloud deployment ostaje otvoren; nema obećanja stalne dostupnosti Free hostinga.

Datum: 2026-10-23. Implementacija prema korisnikovom briefu za potpuni mobilni redizajn.

## Što je promijenjeno

Prije: svi računi/pozivnice/putovanja, detalji i otvorene sekcije bili su u jednom ScrollViewu. Svaka funkcionalnost imala je vlastite stilove; forme su se pojavljivale usred popisa. Datum i vrijeme unosili su se kao tekst.

Sada početni ekran prikazuje sažete kartice nadolazećih/aktivnih putovanja, odvojena prošla putovanja i jednu primarnu akciju. Pozivnica je zaseban obrazac. Otvaranje kartice ulazi u jedno putovanje; ostala putovanja i njihovi obrasci nisu montirani na tom ekranu.

## Navigacija

- Globalno: **Putovanja · Sinkronizacija · Račun**.
- U jednom putovanju: **Pregled · Plan · Mjesta · Troškovi · Više**.
- Više: osobni packing, uspomene, sudionici i postavke putovanja.
- Pregled ima izravne prečace do često korištenih sekcija i sljedeće aktivnosti.
- Dodavanje i uređivanje otvara modal (Android puni ekran, iOS page sheet); detalji zapisa su zasebni prikazi.
- Android Natrag zatvara native modal preko onRequestClose; na ekranu vraća podsekciju na Više, tab na Pregled, a Pregled na popis putovanja. Globalna podstranica vraća se na Putovanja.

Projekt nije imao navigacijsku biblioteku. Zadržan je postojeći React state pristup s eksplicitnim stanjem odabranog putovanja, globalnog ekrana i tipizirane sekcije. Nisu dodani Router/React Navigation niti promijenjeni auth, sync, DB ili HTTP ugovori. Deep-link rutiranje pojedinih zapisa nije dio ovog koraka.

## Sustav komponenti

- `apps/mobile/src/ui/theme.ts`: raspberry #C2185B, pale sky #E0F2FE, bijele površine, neutralni tekst/obrubi; zajednička tipografija, razmaci, radius i stilovi.
- `ui/components.tsx`: gumbi, polja, izbori, prazna stanja, menu retci, modalni obrasci i donja navigacija.
- `ui/Icon.tsx`: dosljedne SVG ikone, bez emojija ili vanjskih fontova.
- `ui/DateField.tsx` i `ui/dates.ts`: native kontrole i odvojene funkcije za kalendarske datume.
- Pregled putovanja je izdvojen u `features/trips/TripOverviewScreen.tsx`. Postojeće feature komponente koriste iste temeljne komponente.

Dodane ovisnosti: SDK 57 verzije `@react-native-community/datetimepicker` 9.1.0 i `react-native-svg` 15.15.4, obje iz ugrađenog Expo popisa. Crypto i SQLite usklađeni su na ~57.0.4 iz istog popisa; nije mijenjan SDK niti shema baze. Offline provjera lokalnog Expo popisa prolazi; ona nije dokaz mrežne provjere Expo servisa.

## Pojedini tokovi

- Plan: vodoravni odabir dana, vrijeme uz sažetak aktivnosti, zasebni detalji/uređivanje i Neraspoređeno. Putovanja dulja od 366 dana imaju dodatni picker za ostale dane, bez montiranja neograničenog broja dana. Uklanjanje datuma uklanja i vrijeme, prema postojećem pravilu neraspoređenih aktivnosti.
- Mjesta/Hrana/Izlasci ostaju tri vidljiva izbora s filtrima Sve/Za posjetiti/Posjećeno. Detalji nude status posjete, vanjsku poveznicu i Dodaj u dnevni plan; prenosi se ID postojećeg mjesta. Nakon spremanja prikazuje se filter Sve kako novi zapis ne bi ostao skriven.
- Packing: osobna checklista s napretkom, brzim dodavanjem i zasebnim uređivanjem/brisanje. Privatnost i server ovlasti nisu promijenjeni.
- Troškovi: odvojen pregled potrošnje/budžeta/preostalog, kratka forma i zasebni detalji. Sažeci po kategoriji, autoru unosa i opcionalnom platitelju koriste BigInt, uključuju lokalne promjene i isključuju obrisane zapise. Nema obračuna dugova.
- Uspomene: pregled s thumbnailima, zaseban detalj i jednostavan foto/tekst obrazac. Neprenesena/nepreuzeta slika nije prikazana kao dostupna offline. Čišćenje obrisanih fotografija ostaje dostupno aktivnim članovima u postavkama, a API i dalje provjerava ovlasti.
- Sudionici: zaseban ekran za vlasnika, popis i upravljanje pozivnicama, zaseban obrazac poziva i native dijeljenje koda. Članu se objašnjava uloga; popis članova API dopušta samo vlasniku, pa UI ne izmišlja roster.
- Sinkronizacija: globalni sažetak redova i postojeće usporedbe lokalne/serverske verzije s potvrdom izbora. Istek prijave čuva lokalni rad i nudi nastavak s lokalnim podacima. Greška/slanje nije skriveno iza uspješnog lokalnog spremanja.

## Datum i vrijeme

Nema tekstualnih polja za datum/vrijeme. Prikaz je hrvatski (`23. 10. 2026.`); pohrana ostaje `YYYY-MM-DD`/`HH:mm`. Picker koristi lokalne kalendarske komponente, bez toISOString/UTC pomaka. Android potvrđuje nativnim dijalogom i poštuje jezik sustava; iOS spinner dobiva hr-HR i eksplicitnu potvrdu/odustajanje. Početak pomiče raniji završetak na isti dan; završetak ima minimum početka. Postojeća validacija štiti aktivnosti pri skraćivanju putovanja.

## Dokazi i granice

Packing native QA 2026-10-28: na Samsungu je puni naslov u edit gumbu istiskivao checkbox sadržaj u uski stupac. Edit akcija zamijenjena je kompaktnom ikonom s minimalnom dodirnom površinom 48 × 48 i punom accessibility oznakom. Čista instalacija, TypeScript, 71 test i oba izvoza prolaze. QA3 je izrađen; fizički prikaz nakon popravka čeka ponovno USB povezivanje/instalaciju. [Checkpoint](ANDROID_DEVICE_QA_2026-10-28.md).

Nastavak 2026-10-27: stvarni Samsung potvrdio je registraciju, native kalendar, spremanje putovanja, hladni start bez API-ja i trajnost neposlanog reda do ponovne sinkronizacije. Back sa Samsung tipkovnicom prethodno je odbacivao obrazac; zajednički modal sada prvo zatvara vidljivu tipkovnicu. Fizički su potvrđeni očuvan nacrt nakon prvog Backa i zatvaranje obrasca nakon drugog. Svih 71 mobilnih testova i oba izvoza prolaze; iPhone i preostali native tokovi ostaju otvoreni. [Puni dokaz](ANDROID_QA_2026-10-27.md).

- TypeScript: prolazi.
- 58 mobilnih testova: prolaze. Postojeći App test prilagođen je stvarnoj novoj navigaciji, ne preskočen. Prolazi tok od prijave i datuma, svih kategorija mjesta i veze s planom, odabira dana, packinga, preciznih troškova, galerije i uspomena do odjave/drugog računa, isteka prijave, sukoba, pozivnica i opozvanog pristupa.
- Novi testovi pickera pokrivaju Android set/dismiss, iOS draft/confirm/cancel, 24-satno vrijeme, uklanjanje opcionalnog datuma i odsutnost tipkovničkog unosa. Native bridgeovi su mockani.
- Datumi provjereni u Europe/Zagreb, America/Los_Angeles i Pacific/Kiritimati, uključujući prijelaze ljetnog vremena.
- 35 PostgreSQL/HTTP scenarija i test zaštite backupa: prolaze. Release build i API liveness: prolaze. Android/iOS Expo izvozi: prolaze.
- Raspored komponenti pregledan je na generiranom HTML prikazu sintetičkih React test stabala širine 390 px. To je pomoćna provjera hijerarhije/prostora, nije native render, emulator ni fizički uređaj.
- Najnoviji instalacijski audit prijavljuje 6 high nalaza; release gate ostaje otvoren. Nije pokrenut audit fix --force. Nema lint skripte ni potvrđenog hosted CI rezultata.

Korisnik je potvrdio otvaranje prethodne verzije na Androidu nakon usklađivanja Expo Go 58.0.5 → SDK 57. To nije potvrda ovog redizajna niti svih native tokova. Na iOS-u i Androidu još ručno provjeriti modalne prijelaze, tipkovnicu, veći font, čitač zaslona, native pickere i galeriju. Offline hladno pokretanje ne dokazuje se kroz Metro/Expo Go; za završnu betu treba instalirani build.

## Što sada isprobati u Expo Go za SDK 57

1. Ponovno učitati Triporu. Otvoriti postojeće putovanje, provjeriti povratak na popis i svih pet unutarnjih tabova.
2. Novo putovanje: odabrati datume kroz kalendar, promijeniti početak, provjeriti završetak i validaciju praznih polja.
3. Hrana → Dodaj mjesto → detalji → Dodaj u dnevni plan. Odabrati dan/vrijeme; provjeriti da je povezano isto mjesto. Odustati od pickera bez promjene prethodnog datuma.
4. Dodati i označiti packing stavku. Unijeti trošak s decimalnim zarezom, provjeriti budžet i sažetke; fotografiju dodati u uspomenu, zatim otvoriti detalj.
5. Probati Android Natrag na podsekciji i otvorenom obrascu. Na iOS-u potvrditi/otkazati spinner, modal i povratak. Provjeriti velik tekst i prikaz iznad tipkovnice.
6. Odspojiti mrežu uz već otvorenu aplikaciju, spremiti izmjene i provjeriti status čekanja. Ponovno povezati i sinkronizirati. S drugim sintetičkim računom provjeriti odvojene podatke i osobni packing.

## Izvori

- [Expo SDK 57 date/time picker](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/)
- [Expo Go SDK kompatibilnost](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)
- [Aktualni status i idući koraci](STATUS.md)
