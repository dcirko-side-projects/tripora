# Tripora na iPhoneu bez Apple članstva

Odobreno 2026-11-03: iPhone dobiva PWA, uz postojeću izvornu Android aplikaciju.
Prvo dovršiti sve dostupne razvojne i automatizirane provjere, pa tražiti stvarni iPhone.
Nema plaćenog Apple računa, nove autentifikacije ni novog plaćenog hostinga.

## Kriterij dovršetka

Korisnik otvori HTTPS poveznicu, doda Triporu na početni zaslon i koristi postojeći
račun/zajednička putovanja. Prethodno spremljeni podaci i preuzete fotografije
ostaju dostupni nakon ponovnog otvaranja bez mreže. Nove promjene ostaju u trajnom
redu, a povratkom veze sinkroniziraju se jednom ili pokazuju eksplicitan konflikt.
Android nastavlja raditi. Spremanje ne smije prijaviti uspjeh prije trajnog zapisa.

## Redoslijed i izlazni kriteriji

1. **Web temelj i platformne granice.** Ponovljiv web build zajedničkog klijenta;
   web adapteri za sesiju, datume, potvrde i kartu. U browser bundleu nema oslanjanja
   na native SecureStore, datumski picker ili MapLibre bridge.
2. **Trajna lokalna baza i offline red.** Isti SQLite modeli/operacije/konflikti;
   preglednik koristi SQL.js/WASM i atomski localStorage snapshot po računu.
   Metapodaci imaju ograničenu browser kvotu; fotografije ostaju odvojeno u IndexedDB.
   Neuspješan zapis mora vratiti prethodne podatke i red, bez gubitka nacrta.
   Provjeriti podršku prije pokretanja, blokirati paralelno otvaranje istog spremišta
   i pokazati grešku umjesto neprimjetnog prelaska na memorijsku bazu.
   Testovi: reload, offline create/edit/delete, retry, konflikt, uklonjen pristup,
   odjava/drugi račun, neuspjelo spremanje i nadogradnja s neposlanim redom.
3. **Fotografije.** PNG 1280 px i thumbnail 320 px ostaju u IndexedDB, odvojeno po
   računu; provjera hashova i postojećih ograničenja. Reload/offline prikaz,
   upload/download retry i brisanje bez gubitka neposlanih zapisa. HEIC koji browser
   ne može dekodirati daje jasnu poruku i čuva tekstualni nacrt.
4. **Instalacija i životni ciklus PWA.** Manifest, ikone, hrvatske upute za Safari,
   service worker samo za javni app shell. Auth/API odgovori, privatne slike i karte
   nikad se ne spremaju u javni cache. Novi worker čeka zatvaranje stare verzije;
   nadogradnja ne osvježava aktivni obrazac i ne briše bazu/red/fotografije.
5. **Automatizirani prihvat.** TypeScript, mobilni testovi, oba native izvoza,
   web build, API Release/health i auth/sync integracija. Browser scenariji u Chromiumu
   i WebKitu: stvarna baza i slike, offline reload, sinkronizacija i konflikt,
   cache granice, update i dvije kartice. Browser WebKit nije dokaz rada na iPhoneu.
6. **HTTPS dostava.** Predložena izvedba: app shell na postojećem API originu,
   iz istog Docker izdanja. Nema dodatnog računa ni CORS-a; session endpointi i
   postojeća autorizacija ostaju. Provjeriti veličinu/hladni start na Render Free,
   sigurnosna zaglavlja, javnu poveznicu i oporavak. Nema keepalive automatizacije.
7. **Završni stvarni iPhone.** Tek nakon prethodnih koraka: Safari → dodavanje na
   početni zaslon, standalone prikaz/safe area/tipkovnica, native galerija i HEIC,
   airplane mode → zatvaranje → ponovno otvaranje → povrat mreže, nadogradnja,
   zajedničko putovanje Android/iPhone i veći tekst. Ispraviti nalaze, ponoviti
   relevantne regresije i zapisati prihvat.

## Granice i odluke koje treba dokazati

- PWA se instalira preko Safarija; nema App Store/TestFlight poveznice.
- Browser storage nema jamstvo protiv korisničkog brisanja podataka ili uklanjanja
  od strane sustava. Zatražiti persistent storage kada je podržan i objasniti rizik
  neposlanih podataka. Privatni način rada nije preporučen za offline putovanja.
- Browser nema Keychain adapter: trajna sesija u origin-scoped IndexedDB omogućuje
  offline otvaranje, ali nije jednaka native SecureStore zaštiti. Bez trećih skripti,
  uz CSP, HTTPS, bez zapisivanja tokena u logove ili service-worker cache.
- Pretpostavljeni prvi podržani iPhone browser: moderni Safari s WebAssembly, Web Locks i
  trajnom browser pohranom; točna donja granica tek nakon browser/device dokaza.
- Karta traži internet; service worker ne preuzima pločice za offline.
- Nema obećanja sinkronizacije dok je PWA zatvorena ni potpuno besplatnog hostinga
  izvan limita postojećih Free servisa.

## Dokazi i nastavak

Implementirani su koraci 1–4: zajednički web klijent, trajni računski SQLite red,
IndexedDB fotografije/sesija, web karta/datum/potvrde, instalacijske upute, manifest,
ikone i verzionirani offline app shell. Pripremljen je i korak 6: isti origin i
Docker paket kao postojeći API, bez novog hostinga, CORS-a ili tajni u klijentu.

Provjereni su čisti npm ci bez vendor zakrpa, TypeScript, 88 mobilnih testova,
Android/iOS/web izvozi, API Release/liveness, backup guard i 52 PostgreSQL/HTTP
scenarija. Završni Linux Chromium/WebKit 1.64.1 krug prolazi svih **25 PWA provjera**:
offline reload; atomski rollback metapodataka i slika pri simuliranom manjku prostora;
slika 2400 px → 1280 px + thumbnail 320 px; puni offline prikaz; izgubljena potvrda
uploada/reload/retry bez duplikata; trajni konflikt, odustajanje i potvrda; Leaflet
s testnim pločicama; odjava/drugi račun/brisanje; nadogradnja s neposlanim redom i
fotografijama. Koraci 1–5 su razvojno/automatizirano provjereni.

Raniji OPFS spike nije isporučena izvedba: pao je na WebKit zapisu i zamijenjen je
atomskim snapshotom bez vendor zakrpa. Prva beta ima ograničen localStorage prostor
za metapodatke (uobičajeno oko 5 MiB prije overhead-a); slike i sesija su u IndexedDB.
Greška kvote mora sačuvati prethodne podatke, red i tekstualni nacrt.

Ponovljiv Linux browser krug (uključuje vlastitu sintetičku PostgreSQL bazu/API):

```sh
docker build -f tests/e2e/Dockerfile.pwa -t tripora-pwa-test:local .
docker run --rm --init --shm-size=1g tripora-pwa-test:local
```

Preostalo prije uređaja: objava provjerenog paketa na
postojećem Render Free servisu i provjera stvarne HTTPS poveznice/zaglavlja/app shella.
Stvarni iPhone prihvat još ne postoji. Ne tražiti korisnika za taj test prije
dovršetka dostupne pripreme ili dokumentiranja konkretne vanjske prepreke.
Aktualni rezultat i sljedeći korak vode se u [STATUS.md](STATUS.md).

Izvori: [SQL.js](https://github.com/sql-js/sql.js),
[WebKit pohrana](https://webkit.org/blog/14403/updates-to-storage-policy/),
[Apple dodavanje na početni zaslon](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
