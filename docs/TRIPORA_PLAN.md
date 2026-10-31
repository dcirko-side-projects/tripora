# Tripora — plan razvoja

Najnovije 2026-10-31: Render Free API radi na https://tripora-l4c7.onrender.com uz Neon, Cloudinary i Brevo. Readiness nakon deploya/restarta i 17 minuta neaktivnosti klijenta, stvarna dostava testne poruke i privatni medijski transport prolaze. Zaseban Tripora Beta 11 APK sa stvarnim originom je izrađen, nije instaliran. Stvarno spavanje/cold start, fizički prihvat nove karte i puni hosted auth/sync/backup još slijede. [Točna konfiguracija i dokazi](HOSTED_BETA_2026-10-31.md), [STATUS](STATUS.md). Stariji registracijski checkpointi ispod ostaju povijest.

Aktualno: sva četiri provider računa su registrirana, Neon je konfiguriran, Brevo telefon/sender potvrđeni. Korisnik je repozitorij učinio javnim i izričito odobrio commit/push svih trenutnih promjena s engleskim opisom. Izvor za Render je **codex/offline-foundation**; još nema stvarnog deploymenta ni povezanih tajni. Korisnik povezuje repozitorij u Renderu. Aktualni dokaz i sljedeći korak: [STATUS](STATUS.md).

Aktualno 2026-10-31 — korisnik je odobrio i implementirani su pretraga mjesta po nazivu/gradu, odabir rezultata, koordinate kroz offline sync i native MapLibre karta. Prolaze 83 mobilna / 48 HTTP scenarija te QA10 Android build; APK nije instaliran/fizički prihvaćen. Zahtjev je 0 € bez bankovne kartice i bez laptopa: pripremljen Render/Neon/Cloudinary/Brevo; korisnik nema račune i tražio je [korake registracije](NO_CARD_SETUP.md). Nema stvarnog deploymenta. [Odluka 0005](decisions/0005-maps-and-no-card-beta.md) i [STATUS](STATUS.md) zamjenjuju raniji research-only/Supabase checkpoint.

Aktualno 2026-10-31: plava #0593C6 / svijetla #FCFFFF / ružičasta #D83995 zamjenjuju staru paletu. Lokalni razvojni i QA HTTPS API ponovno pokrenuti nakon provjere zaostale brave; JSON timeout obuhvaća tijelo odgovora i dopušta 75 s za buđenje. [Promjene i dokazi](DESIGN_CONNECTION_2026-10-31.md), [istraživanje karte bez implementacije](MAP_RESEARCH.md), [aktualni status](STATUS.md). Nova tema još nije instalirana/fizički prihvaćena na telefonu. Cloud deployment ostaje otvoren; nema obećanja stalne dostupnosti Free hostinga.

Aktualno 2026-10-30: korisnik je pokrenuo prve tri release faze; provedeni koraci, otvorene stavke i iduće faze su u [RELEASE_PHASES.md](RELEASE_PHASES.md). Odabrani su besplatni Render/Supabase/Brevo i potvrđen životni ciklus računa ([odluka 0004](decisions/0004-free-beta-and-account-lifecycle.md)). QA9 s novom ikonom instaliran je na Android. iPhone je odgođen. Starije otvorene odluke ispod čitati uz ovaj checkpoint i STATUS.

Datum: 2026-09-26
Status 2026-09-28: korisnik je zatrazio nastavak faza. Pokrenut je izvrsivi tehnicki prototip; faze 0–2 nisu proglasene potpuno dovrsenima. Detalji i provjere: IMPLEMENTATION_CHECKLIST.md i STATUS.md.

## Potvrdjeni zahtjevi

- Primarno mobilna aplikacija za Android i iPhone.
- Offline pregled i unos dio su prve verzije.
- Putovanja, informacije, mjesta za obilazak, hrana, izlasci, troskovi, sudionici i uspomene.
- Vise registriranih korisnika moze koristiti isto putovanje.
- Uspomene ukljucuju fotografije i tekst; druge vrste sadrzaja jos treba definirati.
- Prvo dogovaramo faze i tehnicki temelj, zatim postupno implementiramo.
- Raniji dokument dodatno predlaze itinerary, packing i budzet. Zadrzani su u ovom prijedlogu, uz potvrdu u fazi 0.
- Desktop iskustvo iz izvornog briefa ostaje otvoreno pitanje prioriteta; nije automatski uklonjeno.

## Tehnicki smjer — prototip zapocet, produkcijske odluke otvorene

- React Native + Expo + TypeScript koristi se u pocetnom mobilnom prototipu.
- SQLite na uredjaju: lokalno citanje i spremanje, trajni red promjena za sinkronizaciju.
- ASP.NET Core backend ima Identity autentifikaciju, PostgreSQL/EF Core migraciju i sinkronizaciju vlastitih putovanja. Mobilni UI povezan je 2026-10-21; fizicki uredjaji jos nisu provjereni.
- Privatna objektna pohrana fotografija; metapodaci u bazi, lokalne kopije za offline.
- Jedan backend i jedan repo; organizacija po funkcionalnostima.
- Autentifikacija prilagodjena mobilnim klijentima, sigurna pohrana vjerodajnica, obnova i opoziv sesija. Ne prenositi raniji prijedlog web cookie autentifikacije bez nove procjene.
- Privatni razvojni prototip koristi Identity tokene i eksplicitan protokol sinkronizacije; verzije su u lockfileu. Hosting, email/recovery i produkcijski uvjeti ostaju otvoreni.
- Alternative: Flutter; Ionic/Capacitor za web pristup; PWA ako se prioriteti vrate prema webu. Usporediti offline pohranu, fotografije, razvojno iskustvo, desktop i distribuciju.

## Sekcije proizvoda

- Moja putovanja: buduca, aktivna i prosla.
- Informacije: datumi, destinacija, opis, osnovne prakticne biljeske i sudionici.
- Mjesta: atrakcije, znamenitosti i ostale lokacije.
- Hrana: restorani, kafici i slicno.
- Izlasci: klubovi, barovi i slicno.
- Plan: raspored po danima i nerasporedjene stavke.
- Packing: jednostavna lista stvari za ponijeti.
- Troskovi: unos, pregled i odnos prema budzetu.
- Uspomene: fotografije i tekstualne biljeske.

Mjesta, hrana i izlasci mogu imati odvojene prikaze, uz zajednicki model spremljenog mjesta s kategorijom. Ista lokacija moze biti povezana s planom bez dupliciranja podataka. Tocne kategorije i navigacija dogovaraju se kroz UX.

## Faza 0 — Opseg i odluke

- [ ] Potvrditi granicu prve upotrebljive verzije i zavrsne v1.
- [ ] Zakljuciti platformu, stack i prioritet desktop verzije.
- [ ] Dogovoriti uloge: prijedlog vlasnik i clan; bez velikog role sustava.
- [ ] Dogovoriti tko moze mijenjati/brisati troskove, mjesta i uspomene.
- [ ] Definirati offline stvaranje, promjene, brisanje i pripremu putovanja za offline.
- [ ] Definirati konflikte, istek prijave, uklanjanje clana i odjavu s nesinkroniziranim podacima.
- [ ] Definirati jednu valutu po putovanju, lokalne datume/vremena i vremenske zone.
- [ ] Dogovoriti fotografije: ogranicenja, kompresiju, offline preuzimanje i trosak pohrane.
- [ ] Dogovoriti jezik sucelja, hosting budzet i pristup testnim Android/iPhone uredjajima.
- [ ] Dokumentirati odluke i backlog.

Zavrsetak: prihvacen opseg i tehnicki zapis; sve nerijesene odluke jasno oznacene.

## Faza 1 — Mobilni UX

- [ ] Skicirati tokove: novo putovanje, obilazak, trosak, poziv sudioniku, fotografija.
- [x] Implementirana odvojena globalna i navigacija unutar putovanja prema korisnikovom redizajn briefu 2026-10-23; native UX prihvat ostaje otvoren (UX_REDESIGN.md).
- [ ] Skicirati stanja bez podataka, ucitavanje, greske, offline i sinkronizaciju.
- [ ] Provjeriti velike dodirne povrsine, tipkovnicu, citljivost i pristupacnost.

Zavrsetak: pregledan prototip glavnih tokova na dimenzijama Androida i iPhonea.

## Faza 2 — Tehnicki temelj i dokaz offline rada

- [x] Kreirati pocetne aplikacijske projekte i CI definiciju; hosted CI jos nije potvrden.
- [x] Uvesti lokalnu bazu, pocetnu migraciju i transakcijski red promjena za prototip putovanja.
- [ ] Napraviti mali tok: spremi zapis offline, zatvori aplikaciju, ponovno otvori, sinkroniziraj.
- [ ] Provjeriti ponovljeno slanje bez duplikata i oporavak nakon prekida.
- [ ] Provjeriti pristup fotografiji kopiranoj u trajnu lokalnu pohranu.
- [ ] Testirati na Androidu i iPhoneu; build nije dokaz rada na fizickom uredjaju.

Zavrsetak: lokalni podaci prezive restart, promjene se pouzdano prenesu i nema duplikata.

## Faza 3 — Racuni, putovanja i ovlasti

- [ ] Registracija, prijava, odjava, obnova sesije i oporavak racuna.
- [ ] Kreiranje, uredjivanje i brisanje putovanja; osnovne informacije.
- [ ] Model clanstva i provjera ovlasti na svakom serverskom pristupu.
- [ ] Lokalni podaci odvojeni po racunu; pravila odjave i brisanja lokalnih kopija.
- [ ] Testni deployment s trajnom bazom.

Zavrsetak: korisnik upravlja svojim putovanjem; drugi korisnik bez clanstva ne moze pristupiti.

## Faza 4 — Sinkronizacija i zajednicka putovanja

- [x] Poziv i prihvacanje clanstva online; vlasnik i clan (razvojni defaulti: MEMBERSHIP_CHECKLIST.md).
- [ ] Sinkronizacija izmedju barem dva racuna i dva fizicka uredjaja. Automatizirana dva racuna/lokalne baze prolaze; fizicki uredjaji odgodjeni.
- [x] Verzije zapisa, identifikatori operacija i evidentiranje brisanja.
- [x] Prikaz i rjesavanje konflikata bez tihog gubitka podataka (automatizirane provjere).
- [x] Obrada uklonjenog clana: odbiti buduce neovlastene promjene, jasno prikazati status i sacuvati lokalni red.
- [x] Uvaziti da se vec preuzeti podaci ne mogu trenutno opozvati na uredjaju bez mreze.
- [x] Sinkronizacija pri otvaranju/foreground resume i periodicki retry u foregroundu; povratak veze na mobitelu jos treba fizicki provjeriti. Pozadinski rad nije jamstvo.

Zavrsetak: oba clana vide dozvoljene promjene; offline konflikti i ponovni pokusaji imaju testove.

## Faza 5 — Mjesta, hrana i izlasci

- [x] Odvojeni prikazi Mjesta/Hrana/Izlasci uz zajednicku strukturu podataka.
- [x] Naziv, kategorija, biljeska, adresa/link, status za posjetiti/posjeceno.
- [x] Rucni unos, filtriranje i offline spremanje; vanjske preporuke nisu uvjet.
- [x] Povezivanje mjesta s planom bez kopiranja zapisa.

Automatizirano potvrdeno 2026-10-22: clanovi dodaju/ureduju/brisu mjesta offline te razmjenjuju promjene online, uz restart, retry, konflikte i opoziv pristupa. Pripremi za offline oznacava tek dovrseno preuzimanje metapodataka putovanja, mjesta i novih sekcija; fotografije se preuzimaju posebno. Povezivanje s planom implementirano je u fazi 6; fizicki uredjaji ostaju otvoreni; dokazi: PLACES_OFFLINE_CHECKLIST.md.

## Faza 6 — Plan i packing

- [x] Raspored po danima, opcionalno vrijeme i nerasporedjene aktivnosti.
- [x] Transport i smjestaj kao kategorije; lokacije mogu voditi na vanjsku kartu.
- [x] Osobna packing lista svakog sudionika; korisnik potvrdio 2026-10-22.
- [x] Obrada promjene datuma putovanja kad vec postoje aktivnosti.

Zavrsetak: moze se pripremiti i pratiti konkretno visednevno putovanje offline.

## Faza 7 — Troskovi i budzet

- [x] Brz unos iznosa, naziva, datuma, kategorije i opcionalne biljeske.
- [x] Evidencija autora i po dogovoru platitelja; bez automatskog racunanja dugova.
- [x] Jedna valuta po putovanju i precizna novcana aritmetika.
- [x] Lokalni zbroj ukljucuje promjene na cekanju; server provjerava podatke.
- [x] Testovi duplikata, konkurentnih izmjena, brisanja i zbrojeva.

Zavrsetak: unos je praktican na mobitelu, a nakon sinkronizacije svi imaju uskladjene iznose.

## Faza 8 — Uspomene

- [x] Fotografija i tekstualna uspomena povezana s putovanjem, opcionalno mjestom.
- [x] Trajna lokalna kopija, umanjene slike i granice velicine/broja.
- [x] Odvojeni red slanja medija s ponovnim pokusajima i jasnim statusom.
- [x] Privatna serverska pohrana i pristup samo ovlastenim clanovima.
- [x] Izbor sto se preuzima za offline; nenabavljene slike nisu dostupne bez mreze.
- [x] Pravila brisanja originala, lokalnih kopija i napustenih uploada.

Zavrsetak: fotografija dodana offline prezivi restart, prenese se i postane dostupna drugim clanovima.

Implementacija i automatizirani dokazi faza 6–8: [PHASES_6_8_CHECKLIST.md](PHASES_6_8_CHECKLIST.md). Zavrsni kriteriji na fizickim uredjajima i stvarnom visednevnom putovanju jos nisu potvrdeni; pripadaju privatnoj beti.

## Faza 9 — Integracija i privatna beta

Završni dostupan Android krug 2026-10-29 dovršen: članski trošak, native konflikti s restartom/oba izbora/brisanje, simulirani manjak prostora, WebP/HEIC i trajnost, font 1.5 te osnovni TalkBack fokus. [Dokaz i granice](ANDROID_ACCEPTANCE_2026-10-29.md). Fizički puni disk, pravi LAN denial i puni accessibility audit nisu zamijenjeni simulacijom. Korisnik je izričito odgodio današnji iPhone; zajednička dva fizička uređaja i višednevni beta prihvat ostaju otvoreni. Sljedeći razvojni korak: dependency nalazi te account recovery/HTTPS privatna distribucija.

Aktualno 2026-10-29: QA5 EXIF priprema i oporavak stare prevelike slike u nepromjenjivom redu imaju fizički Samsung PASS. Red=0, jedna uspomena, privatni 800×1280/200×320 PNG-ovi i cold start bez API-ja nakon uklanjanja današnjeg sintetičkog izvornika. Prolaze 73 mobilna testa, oba izvoza i svih 35 PostgreSQL/HTTP scenarija. Telefon vraćen na spremljene postavke. [Dokaz](ANDROID_MEDIA_RECOVERY_2026-10-29.md). Slijede ranije sačuvani članski trošak, ostatak native prihvata i iPhone/dva uređaja; široki kriteriji faze 9 ostaju otvoreni.

Aktualni checkpoint 2026-10-28: QA2 upgrade s neposlanim podacima, upload retry te drugi račun/native offline download i prekinuti download/retry imaju PASS. Native packing unos i ekran nakon opoziva sesije provjereni; pronađeno istiskivanje packing teksta punim edit gumbom. Kod popravljen, svih 71 testova i oba izvoza prolaze, QA3 izrađen; fizička potvrda čeka USB reconnect/instalaciju. [Dokaz i ostatak matrice](ANDROID_DEVICE_QA_2026-10-28.md). Široke stavke ispod ostaju otvorene zbog preostalih uvjeta.

Nastavak device matrice 2026-10-28: potvrđen prekid stvarnog uploada prije kraja tijela zahtjeva i očuvan red nakon cold starta u airplane modeu. USB veza zatim izgubljena; prvo vratiti uređaj/mrežne postavke, potom provjeriti izrađenu QA2 nadogradnju, uspješan retry i native download drugog računa. [Stanje i preostale provjere](ANDROID_DEVICE_QA_2026-10-28.md). Široki kriteriji ispod ostaju otvoreni.

Napredak 2026-10-28: Samsung native PASS za sintetičku PNG uspomenu, odustajanje/odabir u galeriji, trajnu sliku nakon uklanjanja testnog izvornika i cold starta bez API-ja te prijenos bez duplikata. Serverski potvrđene dimenzije/hashovi i odbijanje anonimnog/nečlanskog pristupa. [Dokaz i otvorene provjere](ANDROID_PHOTO_QA_2026-10-28.md). Prekid aktivnog uploada, native download drugog računa, odbijene dozvole, drugi kodeci i iPhone ostaju otvoreni.

Napredak 2026-10-27: djelomični Android native PASS za račun/putovanje, kalendar, hladni start bez API-ja, trajni offline red i ponovljenu sinkronizaciju bez duplikata. Ispravljena i fizički provjerena greška zatvaranja obrasca pri zatvaranju Samsung tipkovnice. [Dokaz](ANDROID_QA_2026-10-27.md). Širi uvjeti ispod ostaju otvoreni; to nije airplane-mode, foto ni iPhone prihvat.

- [x] Dodati integrirani lokalni pregled putovanja i provjeriti component tokove kroz sekcije; native UX potvrda ostaje u beti.
- [ ] Provjeriti slabu mrezu, airplane mode, istek prijave, odbijene dozvole i manjak prostora.
- [ ] Provjeriti nadogradnju aplikacije i migracije s podacima na cekanju.
- [ ] Testirati zajednicko putovanje na stvarnom Androidu i iPhoneu.
- [x] Automatizirano provjeriti ovlasti i povrat razvojne baze/medija/kljuceva; produkcijska sigurnost i udaljeni backup ostaju otvoreni.
- [ ] Pripremiti privatnu distribuciju, upute i popis poznatih ogranicenja.

Zavrsetak: probno putovanje s vise ljudi zavrseno bez izgubljenih promjena ili neovlastenog pristupa.

Razvojna priprema faze 9 provedena 2026-10-22: 46 mobilnih testova, 35 PostgreSQL/HTTP scenarija i zaseban test zastite backupa. Faza jos nije potpisana kao dovrsena: fizicki uredjaji, stvarno putovanje, HTTPS beta okruzenje i instalacijska distribucija ostaju otvoreni. Upute i matrica: [PRIVATE_BETA.md](PRIVATE_BETA.md).

## Faza 10 — Prvo izdanje i portfolio

- [ ] Odluciti ostaje li privatna aplikacija ili ide u trgovine.
- [ ] Provjeriti aktualne uvjete i troskove distribucije prije placanja.
- [ ] Urediti README, arhitekturu, demonstracijske podatke i prikaze bez privatnih podataka.
- [ ] Uvesti osnovne operativne provjere i plan odrzavanja.
- [ ] Desktop/web, AI, integracije i racunanje dugova razmatrati kroz zasebne odluke.

Zavrsetak: ponovljiv release i dokumentirano, provjereno izdanje za dogovorenu publiku.

## Pravila rada

- Jedna mala funkcionalna cjelina po koraku; cilj i kriteriji prije koda.
- Objasniti odluke, posebno nove .NET koncepte kroz Java/Spring usporedbe.
- Testirati relevantno ponasanje u svakoj fazi; ne cekati zavrsnu fazu.
- Main mora biti upotrebljiv; kratke grane i mali smisleni commiti.
- Novi repo pocinje samo dogovorenom dokumentacijom; stari kod/povijest ne slati automatski.
- Tajne, osobne fotografije i stvarni podaci putovanja ne pripadaju repozitoriju.
- Bez mikroservisa, Kubernetes-a, chat sustava, bookinga i AI osnovnih funkcionalnosti.

## GitHub stanje

Aktualno stanje vodi se u STATUS.md. Ovaj plan ostaje prijedlog faza.

## Izvori za tehnicki prijedlog

- https://docs.expo.dev/guides/local-first/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/versions/latest/sdk/imagepicker/
