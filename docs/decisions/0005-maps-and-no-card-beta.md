# 0005 — karta mjesta i beta bez bankovne kartice

Datum: 2026-10-31. Status: korisnik je odobrio početak implementacije nakon dogovora; cloud računi još ne postoje. Nema autorizacije za plaćanje ili davanje kartice. Zamjenjuje map research-only granicu i Supabase osnovu hosting prijedloga iz odluke 0004; životni ciklus računa ostaje isti.

## Korisnikovi zahtjevi

- Besplatna aplikacija i hosting bez bankovne kartice; email/lozinka za korisnike.
- Nema ovisnosti o uključenom laptopu. Prihvatljivo je povremeno kratko automatsko buđenje; nema obećanja SLA/tržišne dostupnosti unutar Free kvota.
- Ručno unošenje naziva, ali položaj se pronalazi po nazivu i gradu. Nije prihvaćeno ručno traženje pina kao glavni tok.
- Karta radi online; spremljeni popis, adrese i bilješke ostaju offline.
- Za početak malo korisnika; eventualni izlazak na tržište traži novu procjenu.

## Implementirani smjer

Native MapLibre 11.5.1 u postojećem Expo/RN klijentu, Popis/Karta unutar Mjesta, zajednički kategorijski/statusni filtri. OSM raster podloga za malu betu, uvijek vidljiva atribucija, identifikacija aplikacije, native HTTP cache; bez offline prefetch/bulk downloada. Provider URL/atribucija dolaze sa servera i mogu se promijeniti bez novog APK-a. Nova native instalacija je potrebna za sam SDK.

Nominatim lookup je izričita akcija korisnika: naziv + grad, najviše pet dedupliciranih provjerenih rezultata i korisnikov odabir. Nema autocompletea, automatskog geokodiranja spremljenih popisa ili nagađanja kad nema rezultata. Globalna DB brava, razmak 1,1 s, cache 30 dana, 12 poziva po računu/min i zadano 200 upstream poziva/dan ograničavaju opterećenje. Cache ne sprema sirovi upit, identitet računa ili privatne bilješke; sadrži hash upita i javne rezultate. [Uvjeti](https://operations.osmfoundation.org/policies/nominatim/) i [tiles pravila](https://operations.osmfoundation.org/policies/tiles/).

PlaceInput/PlaceView dobivaju opcionalni location: latitude/longitude/displayName/provider/providerId. Stariji SQLite JSON zapisi ostaju valjani bez nove lokalne sheme; server aditivnom migracijom dodaje nullable LocationJson i cache tablicu. Koordinate ulaze u postojeći atomski outbox, follow-up, retry, konflikt i tombstone tok. Nova null lokacija ne ulazi u serijalizaciju starog mutacijskog digesta, čime se čuva oblik starih zahtjeva. Promjena naziva/adrese/grada poništava stari odabir; zakašnjeli rezultat prethodnog upita odbacuje se. Brisanje/brisanje računa uklanja serverski položaj; karta ne prikazuje tombstone.

## Priprema hostinga

Render Free API + Neon Free PostgreSQL + Cloudinary Free authenticated originals + postojeći Brevo Free email. Ovo su pripremljeni adapteri/blueprint i [koraci registracije](../NO_CARD_SETUP.md), ne aktivirani resursi. Supabase adapter ostaje za ranije konfiguracije; nije prepisan niti su razvojni podaci migrirani u novi provider. Novi računi i stvarni prihvat uvjet su objave.

Identity/auth/sync ostaju vlastiti. Neon nije novi auth provider. Ključevi ostaju certifikatom šifrirani u PostgreSQL-u, TLS VerifyFull je obavezan, a javni Data API ne smije izložiti tablice. Cloudinary prima potpisane authenticated originalne PNG datoteke; mobitel ne dobiva ključ, secret ili potpisani provider URL. API i dalje provjerava članstvo pri svakom preuzimanju. Inventory orphan cleanup ograničen je na jednom u 30 minuta po procesu; potvrđena brisanja mogu se ponavljati odmah.

Ako registracija nekog servisa ipak uvjetuje bankovnu karticu, zaustaviti taj provisioning i odabrati novu prihvatljivu opciju s korisnikom. Free kvote mogu zaustaviti servis. Nema keepalive automatizacije, plaćene infrastrukture, commita/pusha ili stvarne objave u ovom koraku.

## Otvoreni prihvat

Native karta na Androidu/iPhoneu i stvarna kvaliteta POI rezultata; stvarne registracije bez kartice; buđenje nakon neaktivnosti i višednevni rad; email dostava bez kupljene domene; stvarna privatnost/byte hashovi na Cloudinaryju; zajednički cloud backup/povrat. Lokalni simulatori i buildovi nisu dokaz tih stavki. Javne OSM usluge nisu neograničena tržišna infrastruktura.
