# Popravak pretrage mjesta — 2026-11-01

## Uzrok i granice dokaza

Frontend nije slao polje Adresa: backend je uvijek tražio samo `Name + ", " + City`. Oba sloja zahtijevala su naziv i grad, pa samostalna adresa/grad nisu bili podržani; adresa uz korisnikov vlastiti naziv nije utjecala na upit. Prazni rezultati pamtili su se 30 dana. Testovi su pokrivali samo fiksni naziv+grad uz sintetički odgovor, pa nisu otkrili taj prekid ugovora.

Read-only pregled stvarnih Render logova potvrđuje 2026-10-31 u 22:31:15 CET HTTP 503 iz Search endpointa dok je baza odgovarala i readiness vraćao 200. Catch je gutao razlog greške, a HttpClient logiranje bilo je ograničeno na Warning. Nema sačuvanog razloga na temelju kojeg bi se moglo razlikovati upstream HTTP odbijanje, mrežna greška i neispravan odgovor. Stoga konkretan povijesni upstream uzrok **nije utvrđen**; ne tvrditi da je kriv API ključ, Render sleep ili blokirani IP. Današnji 200 javnog providera s laptopa ne dokazuje njegovu dostupnost iz Rendera.

Render Environment ima `Tripora__Maps__DailySearchLimit=200`, bez prilagođenog SearchUrl. Koristi se zadani `https://nominatim.openstreetmap.org/search`; ne zahtijeva API ključ. Tajne nisu otkrivane ni mijenjane. Objavljeni Render izvor pri pregledu i dalje je `4890618`.

## Promjene

- Mobilni zahtjev uključuje naziv, javnu adresu i grad. Za pretragu je dovoljno jedno polje; spremanje i dalje zahtijeva naziv, koji odabir rezultata popunjava ako je bio prazan.
- Backend prihvaća opcionalna polja uz postojeće duljinske granice i provjeru članstva. Čuva dijakritike, normalizira NFC i razmake te uklanja ponovljene dijelove razdvojene zarezom.
- Prvo traži unesenu kombinaciju. Ako nema rezultata i unesena je adresa, pokušava adresu/grad. Rezultat može biti zgrada/adresa umjesto imenovanog lokala: korisnik vidi puni opis i mora potvrditi točan kandidat. Ne radi fallback samo na grad niti izmišlja koordinate.
- Oba upstream poziva poštuju isti globalni lock, razmak 1,1 s i dnevni budžet. Nema autocompletea ili pozadinskog pretraživanja.
- Nova verzija cache ključa zaobilazi stare prazne rezultate; uspješni rezultati traju 30 dana, prazni pet minuta. Greške se ne spremaju kao prazni rezultati.
- Neispravan pojedinačni kandidat ne ruši valjane. Potpuno neispravan odgovor je 503, prazan valjan odgovor je 200 s praznim popisom; lokalna/upstream kvota je 429. Zapisuje se HTTP status i vrsta greške bez upita/URL-a.
- UI razlikuje nedostupnost, kvotu, nevaljan unos, sesiju, nesinkronizirano putovanje i prazan rezultat. Nacrt ostaje sačuvan; promjena upita odbacuje zakašnjele rezultate. Koordinate i postojeći sync ugovor nisu mijenjani.

## Provjera

- `npm ci`, TypeScript, svih **86 mobilnih testova**, Android i iOS export prolaze. Novi component/SQLite testovi pokrivaju adresu bez naziva/grada, grad bez naziva, točan odabir, popunjavanje naziva, razlikovanje praznog rezultata/nedostupnosti, zakašnjeli odgovor nakon izmjene adrese, spremanje, stvarno zatvaranje/ponovno otvaranje SQLite baze, istu map oznaku i detalje. Native mostovi/renderiranje karte u tim testovima su zamijenjeni testnim adapterima.
- API Release build i HTTP liveness prolaze. Završni deterministički krug prolazi svih **52 HTTP/PostgreSQL scenarija**, uključujući kombinacije polja, č/ć/ž/š/đ, NFC, razmake, ponovljen grad, fallback uz razmak poziva, cache/restart/istek praznih rezultata, neispravne podatke, 503/retry, upstream 429, dnevnu kvotu i njezino iscrpljenje između glavnog i adresnog upita, spremanje, konflikte, retry, brisanje i ovlasti. Zasebni backup guard također prolazi.
- Izričito uključen live krug kroz **stvarni .NET adapter** uspješno pronalazi Šibenik, Đakovo, Ćirilometodsku ulicu 2 u Zagrebu, Trg bana Josipa Jelačića u Zagrebu, Muzej prekinutih veza s adresom i Trg žrtava fašizma u Zagrebu. Odabrani kandidat prolazi stvarni place push, restart API-ja i paginirani pull iz PostgreSQL-a. Koriste se sintetički računi/putovanje, samo javne lokacije i barem 1,2 s između korisničkih upita.
- Za ručni opt-in live krug nakon mobilnih testova i API builda: postaviti `TRIPORA_TEST_LIVE_PLACES=1`, zatim `node --experimental-sqlite tests/e2e/auth-sync.mjs`. Standardni krug ne poziva javni servis. [Nominatim Search ugovor](https://nominatim.org/release-docs/latest/api/Search/), [ograničenja javnog servisa](https://operations.osmfoundation.org/policies/nominatim/).

Prvi puni integracijski pokušaj prošao je sve scenarije pretrage, ali stao na postojećoj razvojnoj bravi u backup koraku. `dev-stop.mjs` vratio je ESRCH; PID 16548 nije postojao i nisu radili dotnet/postgres procesi. Samo zaostala `local-data/development.lock` arhivirana je kao `development.lock.stale-20261101-search`; razvojna baza/PID datoteka nije mijenjana. Ponovljeni puni krug s live provjerama i završni deterministički krug nakon dodatka regresije kvote prolaze.

## Isporuka i preostala provjera

Nema novih ključeva, servisa, troškova ili DB migracija. `Tripora__Maps__SearchUrl` ostaje opcionalni HTTPS endpoint kompatibilan s Nominatimom; `Tripora__Maps__DailySearchLimit` ostaje 200. Javna usluga nema SLA i može odbiti zahtjev; logovi novog koda trebaju pokazati razlog ako se to ponovi iz Rendera.

Naknadni korisnikov zahtjev izričito je odobrio objavu, rad na spojenom telefonu te commit/push. Završena isporuka opisana je ispod. Stara Tripora 12 ne šalje Adresu, stoga je uz API objavljena i mobilna nadogradnja.

## Objavljeno i fizički provjereno — 2026-11-01

- Commiti `f5fac25` (prethodno završeno brendiranje i zapis instalacije) i `941bd341066abfd992c9346b0e26dd2bf507a113` (ovaj popravak) pushani su na `codex/offline-foundation`, uz potvrdu istog udaljenog SHA. Main/legacy nisu mijenjani.
- [Render deploy dep-dbjg58vb9u1s73dujbs0](https://dashboard.render.com/web/srv-dbj16huc6qcc73b6e3a0/deploys/dep-dbjg58vb9u1s73dujbs0) iz `941bd34`: **Deploy succeeded | Live**, 10:13 CET, trajanje 1m05s. Javni `/health/ready` vraća 200 i `ready`; testovi pretrage niže pozivaju taj hosted API iz aplikacije. Nema novih migracija, ključeva ili promjena providera/plana.
- **Tripora 13**, `local.tripora.beta`, versionCode 13 / `0.1.0-beta13`. Gradle `assembleRelease --offline` prolazi, 438 zadataka. Izvor u izoliranom native projektu odgovara mobilnom izvoru; lockfile je identičan. Stvarni Hermes bundle sadrži javni API i novi tekst pretrage (hrvatski nizovi provjereni kao UTF-16LE), bez localhost QA origina. APK `local-data/hosted-beta/Tripora-13.apk`, SHA-256 `a6aa91e3ced62f60bf674b688927b9a1372bfc8c0e6f3dfd7f18dc023a0c8b2f`.
- `adb install -r --user 0` vraća Success; paket/verzija potvrđeni na fizičkom Samsungu SM-S936B. Postojeća sesija i prethodno putovanje ostali su dostupni. Nema deinstalacije, brisanja podataka, odjave ili čitanja korisničkih tokena/lozinki.

| Fizički scenarij kroz hosted API | Rezultat |
| --- | --- |
| Adresa `Cirilometodska ulica 2` + Zagreb, prazan naziv | Pronađen Muzej prekinutih veza; eksplicitni odabir popunjava naziv i položaj. |
| Spremanje odabranog muzeja | Jedno mjesto u sintetičkom putovanju, status Sinkronizirano. |
| Karta i dodir oznake | Stvarno učitani OSM raster i MapLibre oznaka 1; dodir otvara točne detalje, punu adresu i akciju koordinatne navigacije. Navigacijska aplikacija nije pokretana. |
| Ponovna pretraga spremljenog muzeja i pune javne adrese s Ć/č/š | Vraća isti kandidat. |
| Samo grad `Sibenik`, prazan naziv/adresa | Vraća razlikovane kandidate grada i administrativne jedinice. |
| Samo Unicode naziv `Šibenik`, prazna adresa/grad | Vraća kandidate; niz s dijakritikom dolazi iz izričito odabranog gradskog rezultata pa je stvarno poslan iz native obrasca. |
| Sintetički nepoznat naziv `QA Nonindexed 9f3b1` + valjana adresa/Zagreb | Novi adresni fallback nalazi muzej; korisnik i dalje bira kandidat. |
| Isti nepoznati naziv bez adrese | Jasna poruka Nema rezultata, isti nacrt, nema automatski dodanog položaja. |
| Force-stop i cold start | Sesija i spremljeni muzej ostaju; ponovno otvorena karta ima oznaku, koja otvara iste Sinkronizirano detalje. |

Složeni puni opis administrativne jedinice `Grad Šibenik` uz dodatni `Sibenik` dao je valjan prazan odgovor; jednostavan upit `Šibenik` radi. OSM indeksi i administrativni opisi nisu jamstvo pronalaženja svake proizvoljne kombinacije. Prazan rezultat nije prikazan kao nedostupnost i ne briše prethodno potvrđen položaj. Svih č/ć/ž/š/đ već je zasebno pokriveno live .NET scenarijima; fizički rezultati ne zamjenjuju taj dokaz.

Jedan pokušaj automatizacije prekinut je Samsung Account zaslonom novih uvjeta. Nisu prihvaćeni uvjeti ni mijenjan račun; zaštita je odbila daljnji input izvan Tripore i aplikacija je vraćena u prvi plan. Nisu mijenjani radio/font/dozvole/USB forwarding, niti su osobna putovanja uređivana. Ostavljeno je jedno sintetičko `QA Search 2026-11-01` putovanje s jednim muzejem za korisnikov pregled.

Privatni QA dokazi ostaju izvan Gita pod `local-data/hosting-setup`: `tripora13-build.log`, `search-render-live-20261101.png`, `tripora13-unicode-search.xml`, `tripora13-address-fallback.xml`, `tripora13-empty-result.xml`, `tripora13-map-restart.png`, `tripora13-details-restart.xml/png` i `tripora13-map-final.png`. Fizički iPhone, dva uređaja, offline mrežni režimi, višednevni hosting i hosted backup nisu dio ovog prihvata. Završni dokumentacijski commit bilježi ovu isporuku; funkcionalni deployed izvor ostaje `941bd34`.
