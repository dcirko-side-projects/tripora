# Internetska beta bez bankovne kartice

Checkpoint — sva četiri računa su registrirana; Brevo telefon je potvrđen i postojeći pošiljatelj verificiran (freemail dostavu još treba testirati). Render zasad nema pristup Tripora repozitoriju; pripremljen je [pregled objave](DEPLOY_REVIEW.md). Čekaju korisnikovo odobrenje commit/pusha na razvojnu granu i povezivanje samo tog repozitorija s Renderom. Ključevi još nisu preneseni niti je servis deployan.

Checkpoint — Cloudinary račun također je otvoren: potvrđeni Free, ukupno 0 USD, 25 kredita i jedno aktivno okruženje. API secret nije otkriven niti prenesen; stvarni privatni upload još treba potvrditi. Brevo registracija otvorena je za korisnikov nastavak.

Checkpoint: Neon račun i zasebni projekt **Tripora** stvoreni su na Free planu, baza **tripora**, PostgreSQL **17**, regija **Frankfurt**, fiksno **0,25 CU**, scale-to-zero **5 min**. Vjerodajnice nisu prenesene u aplikaciju/Render i nema cloud podataka. Cloudinary Free registracija otvorena je za korisnikov nastavak. Sljedeći koraci su Cloudinary, Brevo i Render; upute ispod ostaju vodič.

Aktualno: 2026-10-31. Korisnik nema račune i traži korake registracije. Cilj je 0 € i nijedna bankovna kartica, uz prihvatljivo povremeno automatsko buđenje. Ovo je nova priprema koja zamjenjuje Supabase kao osnovu starog plana; ništa još nije objavljeno niti povezano sa stvarnim servisima. Lokalni podaci ne migriraju automatski u cloud.

## Što treba otvoriti

| Servis | Svrha | Odabir |
| --- | --- | --- |
| Render | Postojeći ASP.NET API i besplatna HTTPS adresa | Free web service, bez metode plaćanja |
| Neon | PostgreSQL baza, uključujući zaštićene Identity ključeve | Free, novi zasebni projekt, EU regija |
| Cloudinary | Privatne fotografije i thumbnailovi | Free Image and Video API, zaseban product environment |
| Brevo | Potvrda emaila i reset lozinke | Free transactional email |

**Ne unosi karticu niti biraj plaćeni trial/plan.** Ako neki servis u tvojoj registraciji ipak traži karticu kao obveznu provjeru, stani i javi naziv servisa; takav račun ne ispunjava zahtjev. Opis Free plana ne jamči da pojedinačna registracija neće tražiti dodatnu provjeru. Ne trebaš kupiti domenu za API. Korisnici Tripore vide samo postojeće email/lozinka tokove.

## 1. Neon — prvo baza

1. Otvori [Neon](https://neon.com/) i registriraj besplatan račun.
2. Kreiraj zaseban projekt Tripora, Free, u dostupnoj EU regiji blizu Render servisa. Ne uključuj Neon Auth, Data API, javni REST pristup aplikacijskim tablicama ni plaćene dodatke. Zadržavamo naš ASP.NET Identity.
3. Odaberi najmanji dostupan compute (0,25 CU ako je ponuđen), bez povećavanja na stalni veliki compute. Zadrži scale-to-zero.
4. U Connect dijalogu odaberi standardni PostgreSQL connection string; za startup migracije koristi izravni endpoint. Naš server koristi Npgsql oblik iz [predloška](../deploy/.env.example), uz stvarni host/bazu/korisnika/lozinku i **SSL Mode=VerifyFull**. Nemoj kopirati samo `sslmode=require` jer naš startup namjerno zahtijeva provjeru certifikata.
5. Lozinku čuvaj u password manageru i kasnije unesi izravno u Render secret. Ne lijepi je u chat, repo, screenshot ili mobilni build.

Neon službeno navodi Free bez kartice i automatsko ponovno aktiviranje na pristup. Trenutačno navodi 100 CU-sati mjesečno i 1 GB baze po projektu; kvote provjeri i u vlastitom dashboardu. Iscrpljenje kvote nije isto što i normalno spavanje te može zaustaviti rad do obnove kvote. [Plan](https://neon.com/pricing), [scale-to-zero](https://neon.com/docs/introduction/scale-to-zero).

## 2. Cloudinary — privatne fotografije

1. Otvori [Cloudinary Free](https://cloudinary.com/pricing), registriraj račun bez kartice i odaberi Image and Video API.
2. Koristi zaseban product environment za Triporu. U API Keys postavkama pronađi cloud name, API key i API secret.
3. Nemoj stvarati unsigned upload preset niti ručno postavljati fotografije kao public. Adapter šalje samo potpisane `authenticated` uploade, s odvojenim originalom i thumbnailom te prefiksom `tripora/`.
4. Vrijednosti idu u Render `Tripora__Storage__CloudName`, `Tripora__Storage__ApiKey`, `Tripora__Storage__ApiSecret`. Tajne i privremene potpisane download adrese ostaju na API-ju; mobitel dobiva postojeći ovlašteni API odgovor.

Free oglašava 25 mjesečnih kredita i registraciju bez kartice. Krediti pokrivaju kombinaciju pohrane, prometa i obrada; nisu 25 GB svake usluge zasebno. Dokazati privatnost stvarnim anonimnim zahtjevom, ne samo UI oznakom. Naš adapter ne radi transformacije fotografija; čuva pripremljene PNG-ove i njihov SHA-256. Potpisani download troši promet; prije bete provjeriti kvote i identične bajtove. [Cjenik](https://cloudinary.com/pricing), [kontrola pristupa](https://cloudinary.com/documentation/control_access_to_media).

## 3. Brevo — email

1. Otvori [Brevo](https://www.brevo.com/) i ostani na Free planu. Dovrši traženu potvrdu računa.
2. U Senders postavkama dodaj vlastitu sender email adresu i potvrdi je preko primljenog emaila. Tripora neće slati u tvoje ime prije te potvrde.
3. Ako je potrebno, aktiviraj transactional slanje; napravi transactional API key.
4. U Render kasnije unesi verificiranu adresu u `Tripora__Email__From` i ključ u `Tripora__Email__ApiKey`. Naš adapter koristi HTTPS API, ne SMTP.

Free ima dnevnu kvotu poruka. Stvarna dostavljivost bez vlastite domene još nije dokazana: potrebni su potvrda i reset na kontroliranom računu, uključujući spam mapu. Ako sender nije prihvaćen bez plaćanja/domene, ne kupujemo ništa i ne isključujemo potvrdu emaila; prvo dogovaramo prihvatljivu alternativu. Stariji [email izvori i ograničenja](FREE_BETA_SETUP.md) ostaju relevantni za Brevo.

## 4. Render — registracija, pa deployment

1. Registriraj se na [Render](https://render.com/) bez dodavanja metode plaćanja. Možeš zasad stati na praznom dashboardu.
2. Nemoj još objavljivati stari GitHub main. Aktualne promjene su lokalno, bez commita/pusha. Prvo se priprema i pregledava namijenjeni izvor; push se obavlja tek uz korisnikovu autorizaciju.
3. Kad izvor bude spreman u dogovorenoj grani, kreirati Free web service iz [render.yaml](../render.yaml): Docker, automatski deployment isključen, port 8080. Renderov Free PostgreSQL ne koristiti jer istječe.
4. Postaviti tajne iz [predloška](../deploy/.env.example). PublicUrl je stvarni `https://...onrender.com` origin. DatabaseProvider je Neon, Storage Mode Cloudinary, Email Mode Brevo. Autentifikacija i potvrda emaila ostaju uključene.
5. Za Identity ključeve postojeći [generator certifikata](../deploy/create-key-certificate.ps1) stvara privatne datoteke u ignored local-data/hosted-beta. Ako već postoje, ne prepisivati ih i ne regenerirati bez postupka rotacije. Base64 PFX i njegova lozinka postavljaju se kao Render secrets.
6. Startup izvršava migracije i odbija nepotpunu hosted konfiguraciju/neprovjeren DB TLS. Readiness provjerava bazu; ne dokazuje email niti privatne fotografije.

Render Free automatski se uspavljuje nakon 15 minuta i budi novim zahtjevom, okvirno oko minute. Bez metode plaćanja kvote mogu zaustaviti servis umjesto naplate; postoji i ograničenje izlaznog prometa prema vanjskim servisima. To je privatna beta bez SLA, ne jamstvo stalnog rada za tržišno izdanje. Ne uvodimo keepalive pingove. [Službena pravila](https://render.com/docs/free).

## 5. Mobilna verzija i karta

Nakon stvarnog deploymenta novi mobilni build dobiva stvarni Render HTTPS origin preko EXPO_PUBLIC_API_URL. To mijenja account scope: razvojni računi/podaci se ne šalju automatski. API URL mora se provjeriti u ugrađenom bundleu, ne samo u environment varijabli.

Karta koristi MapLibre native i treba novi APK/native build; Expo Go i stari QA9 nemaju taj modul. Lookup ide po korisnikovom nazivu + gradu na pritisak „Pronađi mjesto”; korisnik potvrđuje jedan rezultat. Offline popis ostaje dostupan, ali nema offline podloge ili automatskog mrežnog traženja pri spremanju. Pogrešan/nepronađen naziv ne proizvodi izmišljeni pin.

OSM/Nominatim ne traže karticu/ključ za ovu malu betu. Pretraga ima zajednički cache 30 dana, globalnu DB bravu, najmanje 1,1 s između početaka upstream zahtjeva, 12 pokušaja po računu/min i zadano najviše 200 upstream zahtjeva/dan. Nema autocompletea ni skupnog geokodiranja. Provider se može promijeniti serverskom konfiguracijom bez nove verzije aplikacije. Naziv i grad šalju se provideru; privatne bilješke/računi/fotografije ne šalju se. Rezultati nose OSM atribuciju. [Obvezna pravila pretrage](https://operations.osmfoundation.org/policies/nominatim/).

OSM podloga je best-effort, uz identifikaciju Tripora/0.1, vidljivu atribuciju i HTTP cache native SDK-a. Nema bulk/offline preuzimanja. Kad aplikacija naraste ili servis zatraži promjenu, treba drugi tile/search provider; javni OSM nije besplatan neograničen komercijalni backend. [Tiles pravila](https://operations.osmfoundation.org/policies/tiles/).

## Prije proglašenja internetske bete spremnom

- [ ] Sva četiri stvarna računa rade bez kartice; tajne unesene samo server-side.
- [ ] Deployan namijenjeni izvor; /health/ready radi preko interneta, laptop ugašen/nepotreban.
- [ ] Prva prijava/potvrda/reset emaila stvarno rade; stari tokeni nakon reseta odbijeni.
- [ ] Nakon više od 15 min neaktivnosti app automatski nastavlja, bez ručnog pokretanja; zasebno višednevna provjera.
- [ ] Dva sintetička klijenta razmjenjuju koordinate, offline promjene i konflikte; uklonjeni član nema pristup.
- [ ] Stvarni lookup i karta na native Androidu/iPhoneu; podaci/točnost po potvrđenom rezultatu, bez obećanja pokrivenosti svih objekata.
- [ ] Stvarne Cloudinary fotografije anonimno odbijene; upload retry i identični hashovi nakon downloada/restarta.
- [ ] Hosted backup/povrat Neon baze, privatnih fotografija i certifikata provjeren kao cjelina. Postojeći cold lokalni backup nije cloud backup.
- [ ] Poznate kvote, alerti i postupak oporavka. Nema obećanja tržišne dostupnosti unutar besplatnih kvota.

Za sljedeći nastavak dovoljno je javiti koji su računi otvoreni. Ne šalji API ključeve, lozinke, connection string ni certifikat u chat.
