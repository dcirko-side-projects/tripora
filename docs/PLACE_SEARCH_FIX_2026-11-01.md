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

Popravak treba objaviti na API-ju i uključiti u novu mobilnu instalacijsku verziju. Stara Tripora 12 ne šalje Adresu, stoga sam deploy API-ja ne isporučuje cijeli popravak. U ovom koraku nema commita/pusha/deploya/instalacije. Fizički Android/iPhone test i stvarni hosted tok nakon objave ostaju otvoreni; export i automatizirani SQLite/UI test nisu fizički dokaz karte.
