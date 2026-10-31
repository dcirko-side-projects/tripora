# Faza 9 — privatna beta

Datum: 2026-10-25. Razvojni dio je implementiran; beta još nema završno odobrenje na fizičkim uređajima.

Aktualizacija 2026-10-29: dostupni završni Samsung krug dovršen je uz dokumentirane granice stvarnog disk-full/LAN denial testa i opsega pristupačnosti. [Završna Android matrica](ANDROID_ACCEPTANCE_2026-10-29.md) uključuje članski trošak, konflikte/brisanje, QA-only simulaciju manjka prostora, WebP/HEIC, cold start, veći tekst i osnovni TalkBack. Korisnik je danas odgodio iPhone/dva uređaja; taj prihvat nije automatski označen dovršenim. Faza 9 i dalje traži dogovorenu distribuciju/okruženje i stvarno probno putovanje.

Puni automatizirani funkcionalni krug i konkretni nalazi: [QA_REPORT_2026-10-25.md](QA_REPORT_2026-10-25.md). Oba otkrivena UI problema ispravljena su; native prihvat i dalje ostaje otvoren.

## Što je provjereno

- [x] Pregled svakog putovanja: mjesta/posjećenost, aktivnosti/neraspoređeno, osobni packing, precizni troškovi/preostali budžet, uspomene/fotografije na uređaju, čekanje i greške.
- [x] Sintetički component tok kroz sve sekcije, offline izmjene i dva odvojena računa.
- [x] SQLite migracije v1/v2 → v3, restart i redovi promjena; transakcijski neuspjeh i simulirani manjak prostora čuvaju prethodne podatke.
- [x] Odbijena/otkazana galerija, prekidi prijenosa i preuzimanja; native adapter čisti privremene slike i pri neuspjeloj izradi thumbnaila.
- [x] Odjava tijekom zapisivanja sesije ili osvježavanja ne vraća stare tokene.
- [x] Zakašnjela obnova sesije ne poništava odjavu/promjenu računa; zakašnjeli HTTP odgovor ne ponavlja stari zahtjev tokenom drugog računa. Devet regresijskih testova; ukupno 71 mobilni test prolazi.
- [x] Provjera ovlasti/autora, osobnog packinga, uklanjanja članova i privatnosti fotografija; auth/API odgovori private/no-store.
- [x] Stvarni povrat hladnog backupa u novu PostgreSQL instancu: računi, ključevi/tokeni, članstvo, operacijske potvrde, sinkronizacijski brojač i privatne fotografije.
- [x] Odbijanje aktivne baze, zauzete maintenance brave, oštećenih datoteka, izlaska iz local-data i prepisivanja postojeće mape.
- [ ] Instalirani Android i iPhone: native SecureStore/SQLite, galerija/codec i uklanjanje metapodataka, dozvole, hladni start u airplane modeu i stvarno nizak prostor.
- [ ] Stvarno zajedničko višednevno probno putovanje, čitljivost/veličina teksta, tipkovnica, čitač zaslona i praktičnost navigacije.
- [ ] Potvrda emaila/oporavak računa, odabrana HTTPS beta infrastruktura i privatni instalacijski paketi. Nije odabran email/cloud servis ni plaćena distribucija.

## Pokretanje i uredno gašenje

Nakon instalacije ovisnosti i Release builda API-ja, iz korijena repozitorija:

```sh
node tests/e2e/dev.mjs
```

Runner ispisuje Android/iPhone linkove i sprema local-data/development/links.json. Koristiti sintetičke račune na istoj pouzdanoj Wi-Fi mreži. Expo Go služi za razvojni pregled; ne dokazuje hladni start bez Metro servera. API je namjerno blokiran izvan Development/Testing okruženja dok email/recovery nije dovršen.

Za pozadinski runner ili drugi terminal:

```sh
node tests/e2e/dev-stop.mjs
```

Nastaviti tek kad ispiše da je stack zaustavljen i brava otpuštena. Ctrl+C također uredno gasi runner. Nemoj koristiti prisilno gašenje baze prije backupa. Brava je local-data/development.lock; nakon rušenja provjeriti zapisani PID i odsutnost API/Expo/PostgreSQL procesa prije ručnog uklanjanja stale brave. Alat je ne briše automatski.

## Backup i povrat

Backup obuhvaća bazu, fotografije, token ključeve i settings s razvojnim DB vjerodajnicama. Nije šifriran; čuvati privatno i izvan Gita. Windows koristi naslijeđeni ACL mape: Unix mode nije jamstvo Windows zaštite. Kopija na istom disku ne štiti od gubitka laptopa. Neposlane promjene na telefonu nisu dio server backupa.

Nakon urednog gašenja odabrati nove, nepostojeće odredišne mape unutar local-data:

```sh
node tests/e2e/local-backup.mjs backup local-data/development local-data/backups/beta-01
node tests/e2e/local-backup.mjs restore local-data/backups/beta-01 local-data/recovered-beta-01
```

Alat provjerava putanje i sve SHA-256 sažetke prije stvaranja cilja povrata; postojeći cilj odbija. Nedovršene operacije ostaju u .partial mapi i ne prijavljuju uspjeh. Snapshot je fizička kopija PostgreSQL 17 klastera za isti OS/arhitekturu. Za prijelaz na drugi OS ili produkciju treba poseban logički dump/restore postupak. Snapshot treba pouzdan izvor; sažeci nisu digitalni potpis.

Pokretanje povratne kopije u PowerShellu:

```powershell
$env:TRIPORA_DEV_DATA = 'C:\Dev\SideProjects\tripora\local-data\recovered-beta-01'
node tests/e2e/dev.mjs
```

Stara mapa ostaje sačuvana. Nakon provjere povrata zaustaviti runner i ukloniti samo varijablu okruženja ako se želi vratiti na izvor: Remove-Item Env:TRIPORA_DEV_DATA. Prvi prelazak na eksplicitnu pohranu ključeva može tražiti ponovnu prijavu; lokalni redovi ostaju.

## Plan testa na uređajima

Foto prihvat 2026-10-28: stvarni Samsung picker i odustajanje, sintetička PNG uspomena bez API-ja, trajna slika nakon uklanjanja testnog izvornika/cold starta te privatni upload imaju djelomični PASS. [Dokaz](ANDROID_PHOTO_QA_2026-10-28.md). To ne zatvara airplane mode, odbijene dozvole, aktivno prekinuti upload, native download drugog računa, ostale kodeke ni iPhone.

Redizajn ekrana i šest početnih Expo Go scenarija: [UX_REDESIGN.md](UX_REDESIGN.md). Pokretanje prethodne verzije na Androidu korisnik je potvrdio nakon usklađivanja na Expo Go za SDK 57; prihvat redizajna i ostalih native tokova ostaje otvoren.

### Ako Expo Go prikazuje „Something went wrong”

Otvoriti „View error log” i zabilježiti cijelu grešku. U pregledniku na mobitelu otvoriti `http://ADRESA_LAPTOPA:8081/status` s adresom iz `local-data/development/links.json`: očekuje se `packager-status:running`. Ako to nije dostupno, provjeriti istu Wi-Fi mrežu, izolaciju klijenata/VPN i postojeća firewall pravila; HTTP 200 na laptopu ne dokazuje pristup s mobitela. Ne gasiti firewall niti mijenjati mrežne profile bez provjere uzroka.

Projekt koristi SDK 57. Ako log izričito navodi nekompatibilan SDK, instalirati kompatibilni Android Expo Go odabirom SDK-a 57 na [službenoj Expo stranici](https://expo.dev/go?sdkVersion=57&platform=android&device=true), prema [uputama za neusklađene verzije](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). Ne pretpostavljati da generička poruka sama potvrđuje problem verzije. Ne brisati podatke aplikacije tijekom dijagnostike.

### Prihvatni scenariji

Koristiti dva sintetička računa i instalirane development/release buildove koji mogu otvoriti aplikaciju bez Metro servera. HTTPS API potreban je izvan razvojnog moda. Paketima i distribuciji pristupiti nakon odabira beta okruženja; Expo export nije instalacijski paket.

1. Android vlasnik napravi putovanje, mjesta, plan, budžet i foto uspomenu; iPhone član prihvati poziv, preuzme metapodatke i namjerno preuzme fotografiju.
2. Oba uređaja prebace u airplane mode, potpuno zatvore aplikaciju i ponovno je otvore. Provjeriti sesiju, prethodne zapise i sliku; napraviti različite troškove i promjene istog plana. Packing liste moraju ostati osobne.
3. Ponovno uključiti mrežu, prekinuti slanje fotografije, ponoviti sinkronizaciju. Oba troška moraju postojati jednom; sukob plana traži izbor bez gubitka nacrta.
4. Odbiti galeriju, zatim dopustiti ograničen izbor; odustati od pickera. Testirati nizak prostor, veći tekst i tipkovnicu. Ne prijaviti spremljeno ako lokalna transakcija/kopija nije uspjela.
5. Opozvati sesije i ukloniti člana dok je offline. Stara lokalna kopija može ostati čitljiva; ponovno slanje mora biti odbijeno uz očuvan red. Obnoviti isti račun; provjeriti odjavu/usputni sync i drugi račun.
6. Nadograditi instalirani build s neposlanim promjenama i ponoviti cold start/sync. Napraviti stvarno probno putovanje i provjeriti backup/povrat prije prihvaćanja bete.

Za svaki zapisati uređaj/OS, build SHA/verziju, korake, očekivano/stvarno i rezultat. Android ima djelomični fizički PASS za registraciju, native datum, putovanja, hladni start bez API-ja, trajni offline red i ponovno slanje bez duplikata te popravak tipkovnice: [dokaz 2026-10-27](ANDROID_QA_2026-10-27.md). Puni Android prihvat i iPhone ostaju PENDING. Zaustaviti beta rollout kod izgubljene promjene, neovlaštenog pristupa ili izgubljene lokalne fotografije.

## Ograničenja prije distribucije

Čista instalacija 2026-10-27 prijavljuje 4 high nalaza mobilnih ovisnosti (audit 2026-10-23 prijavljivao je 6), bez potvrđenog hosted CI rezultata. Nalazi nisu riješeni. Auth recovery/email nije konfiguriran. Nema odabranog hostinga, udaljenog backupa, produkcijske enkripcije ključeva ni store/TestFlight paketa. Testovi s mockanim native bridgeovima ne pokrivaju stvarni OS/galeriju/codec. Ograničenja fotografija i ostale razvojne politike ostaju reviewable.

Aktualni dokazi: [STATUS.md](STATUS.md). Plan: [TRIPORA_PLAN.md](TRIPORA_PLAN.md).
