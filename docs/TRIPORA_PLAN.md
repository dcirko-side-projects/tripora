# Tripora — plan razvoja

Datum: 2026-09-26
Status: prijedlog faza; nema odobrenja za implementaciju aplikacije niti zakljucanog stacka.

## Potvrdjeni zahtjevi

- Primarno mobilna aplikacija za Android i iPhone.
- Offline pregled i unos dio su prve verzije.
- Putovanja, informacije, mjesta za obilazak, hrana, izlasci, troskovi, sudionici i uspomene.
- Vise registriranih korisnika moze koristiti isto putovanje.
- Uspomene ukljucuju fotografije i tekst; druge vrste sadrzaja jos treba definirati.
- Prvo dogovaramo faze i tehnicki temelj, zatim postupno implementiramo.
- Raniji dokument dodatno predlaze itinerary, packing i budzet. Zadrzani su u ovom prijedlogu, uz potvrdu u fazi 0.
- Desktop iskustvo iz izvornog briefa ostaje otvoreno pitanje prioriteta; nije automatski uklonjeno.

## Predlozeni tehnicki smjer — nije zakljucan

- React Native + Expo + TypeScript za mobilni klijent.
- SQLite na uredjaju: lokalno citanje i spremanje, trajni red promjena za sinkronizaciju.
- ASP.NET Core backend, PostgreSQL i EF Core kao kandidati.
- Privatna objektna pohrana fotografija; metapodaci u bazi, lokalne kopije za offline.
- Jedan backend i jedan repo; organizacija po funkcionalnostima.
- Autentifikacija prilagodjena mobilnim klijentima, sigurna pohrana vjerodajnica, obnova i opoziv sesija. Ne prenositi raniji prijedlog web cookie autentifikacije bez nove procjene.
- Hosting, autentifikacijski provider, biblioteka za sinkronizaciju i precizne verzije biraju se u fazi 0 nakon provjere kompatibilnosti i troskova.
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
- [ ] Dogovoriti navigaciju bez pretrpavanja donje trake svim sekcijama.
- [ ] Skicirati stanja bez podataka, ucitavanje, greske, offline i sinkronizaciju.
- [ ] Provjeriti velike dodirne povrsine, tipkovnicu, citljivost i pristupacnost.

Zavrsetak: pregledan prototip glavnih tokova na dimenzijama Androida i iPhonea.

## Faza 2 — Tehnicki temelj i dokaz offline rada

- [ ] Tek nakon dogovora kreirati aplikacijske projekte i CI.
- [ ] Uvesti lokalnu bazu, migracije i transakcijski red promjena.
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

- [ ] Poziv i prihvacanje clanstva online; vlasnik i clan.
- [ ] Sinkronizacija izmedju barem dva racuna i dva uredjaja.
- [ ] Verzije zapisa, identifikatori operacija i evidentiranje brisanja.
- [ ] Prikaz i rjesavanje konflikata bez tihog gubitka podataka.
- [ ] Obrada uklonjenog clana: odbiti buduce neovlastene promjene, jasno prikazati status.
- [ ] Uvaziti da se vec preuzeti podaci ne mogu trenutno opozvati na uredjaju bez mreze.
- [ ] Sinkronizacija pri otvaranju i povratku veze; pozadinski rad nije jamstvo.

Zavrsetak: oba clana vide dozvoljene promjene; offline konflikti i ponovni pokusaji imaju testove.

## Faza 5 — Mjesta, hrana i izlasci

- [ ] Odvojeni prikazi za korisnika uz zajednicku strukturu podataka.
- [ ] Naziv, kategorija, biljeska, adresa/link, status za posjetiti/posjeceno.
- [ ] Rucni unos, filtriranje i offline spremanje; vanjske preporuke nisu uvjet.
- [ ] Povezivanje mjesta s planom bez kopiranja zapisa.

Zavrsetak: clanovi mogu dodavati i pregledavati mjesta offline te razmijeniti promjene online.

## Faza 6 — Plan i packing

- [ ] Raspored po danima, opcionalno vrijeme i nerasporedjene aktivnosti.
- [ ] Transport i smjestaj kao kategorije; lokacije mogu voditi na vanjsku kartu.
- [ ] Packing lista; prije implementacije odabrati osobnu ili zajednicku semantiku.
- [ ] Obrada promjene datuma putovanja kad vec postoje aktivnosti.

Zavrsetak: moze se pripremiti i pratiti konkretno visednevno putovanje offline.

## Faza 7 — Troskovi i budzet

- [ ] Brz unos iznosa, naziva, datuma, kategorije i opcionalne biljeske.
- [ ] Evidencija autora i po dogovoru platitelja; bez automatskog racunanja dugova.
- [ ] Jedna valuta po putovanju i precizna novcana aritmetika.
- [ ] Lokalni zbroj ukljucuje promjene na cekanju; server provjerava podatke.
- [ ] Testovi duplikata, konkurentnih izmjena, brisanja i zbrojeva.

Zavrsetak: unos je praktican na mobitelu, a nakon sinkronizacije svi imaju uskladjene iznose.

## Faza 8 — Uspomene

- [ ] Fotografija i tekstualna uspomena povezana s putovanjem, opcionalno mjestom.
- [ ] Trajna lokalna kopija, umanjene slike i granice velicine/broja.
- [ ] Odvojeni red slanja medija s ponovnim pokusajima i jasnim statusom.
- [ ] Privatna serverska pohrana i pristup samo ovlastenim clanovima.
- [ ] Izbor sto se preuzima za offline; nenabavljene slike nisu dostupne bez mreze.
- [ ] Pravila brisanja originala, lokalnih kopija i napustenih uploada.

Zavrsetak: fotografija dodana offline prezivi restart, prenese se i postane dostupna drugim clanovima.

## Faza 9 — Integracija i privatna beta

- [ ] Dovrsiti pregled putovanja i tokove izmedju sekcija.
- [ ] Provjeriti slabu mrezu, airplane mode, istek prijave, odbijene dozvole i manjak prostora.
- [ ] Provjeriti nadogradnju aplikacije i migracije s podacima na cekanju.
- [ ] Testirati zajednicko putovanje na stvarnom Androidu i iPhoneu.
- [ ] Provjeriti sigurnost pristupa, backup i povrat baze i medija.
- [ ] Pripremiti privatnu distribuciju, upute i popis poznatih ogranicenja.

Zavrsetak: probno putovanje s vise ljudi zavrseno bez izgubljenih promjena ili neovlastenog pristupa.

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
