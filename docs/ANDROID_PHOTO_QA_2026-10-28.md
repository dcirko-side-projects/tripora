# Android — trajnost i prijenos foto uspomene

Datum: 2026-10-28. Mali end-to-end prihvat faze 9: odabir sintetičke PNG slike → spremanje bez API-ja → hladni start → slanje i privatni serverski pristup.

## Uređaj i kriterij

Samsung Galaxy S25+ SM-S936B, Android 17/API 37. Postojeći samostalni paket `local.tripora.qa` 0.1.0/1, bez Metroa. SHA-256 instaliranog APK-a neovisno očitan s uređaja: `f463ff488d5e9aafabda0d3b4fa233847dbfbce9a0c20e251d1b82808fedbc25`. Koristi se isti build kao u [prethodnom prihvatu](ANDROID_QA_2026-10-27.md); nije izrađen novi paket.

Kriterij: fotografija dodana bez dostupnog servera ostaje vidljiva nakon uklanjanja testnog izvornika i potpunog zatvaranja aplikacije, zatim se prenese jednom nakon povratka veze. Serverske slike moraju odgovarati hashovima i granicama dimenzija te biti nedostupne anonimnom računu i računu bez članstva.

## Postupak i rezultat

| Provjera | Rezultat |
|---|---|
| Native Android photo picker iz obrasca uspomene | PASS; otvoren stvarni sustavski picker |
| Odustajanje od pickera tipkom Back | PASS; povratak u postojeći obrazac bez dodane fotografije |
| Odabir iz zasebnog Tripora-QA albuma | PASS; odabrana samo generirana slika, četiri obojena kvadranta, 1600 × 1000 |
| Native obrada i pregled prije spremanja | PASS; minijatura vidljiva u obrascu |
| Spremanje `QA-photo-20261028` dok HTTPS QA API nije dostupan | PASS; uspomena i fotografija vidljive, 2 stavke na čekanju |
| Uklanjanje samo generiranog izvornika iz QA albuma, force-stop i cold start | PASS; sesija, uspomena, red i puna slika ostaju dostupni bez servera; screenshot vizualno provjeren |
| Pokretanje lokalnog HTTPS API-ja i USB prosljeđivanja | PASS; foreground sinkronizacija prazni red na 0; detalj prikazuje „Fotografija je poslana i spremljena na uređaju” |
| Dodatna ručna sinkronizacija | PASS; neovisni pull potvrđuje jednu živu uspomenu s očekivanim naslovom i istim media ID-jem |
| Autentificirano preuzimanje slike i minijature kroz lokalni API | PASS; hashovi odgovaraju bajtovima; Cache-Control private/no-store |
| Anonimni pristup objema slikama | PASS; HTTP 401 |
| Pristup drugog sintetičkog računa bez članstva | PASS; HTTP 404 za obje slike |

## Stvarni izlaz native obrade

| Kopija | Dimenzije | Bajtovi | SHA-256 |
|---|---|---|---|
| Slika | 1280 × 800 | 4869 | `ac531dcbb0057b8a4cb3bea3e1f9de660eaa873b51df268d74537a14d97ed368` |
| Minijatura | 320 × 200 | 745 | `2336a6e6caac6215c98fa2210452ac9801f810a1ac0bd6b3471c444df207a000` |

Izvor je sadržavao sintetički PNG tEXt komentar; prenesene kopije imaju samo IHDR/sBIT/sRGB/IDAT/IEND. To potvrđuje uklanjanje tog konkretnog komentara i odsutnost eXIf u ovom izlazu. Nisu provjereni JPEG/HEIC, EXIF/GPS obrada ni svi Android kodeci.

## Granice dokaza

API je tijekom offline dijela bio nedostupan, a Wi-Fi/mobilni radio nisu mijenjani. Ovo nije airplane-mode prihvat niti test prekida usred aktivnog uploada. Otkazivanje pickera je provjereno; odbijanje dozvole nije izazvano niti proglašeno provjerenim. API preuzimanje nije isto što i native eksplicitno offline preuzimanje na drugom računu/uređaju. Nizak prostor, zamjena/brisanje slike, uklanjanje člana, iPhone i veće stvarne fotografije ostaju otvoreni.

Nema izmjene aplikacijskog koda, dependencyja, DB/API ugovora ni infrastrukturnih odluka. Nije ponavljan puni mobilni/API automatizirani skup niti build/export; posljednji takvi rezultati ostaju datirani prethodnim provjerama. Za ovu cjelinu provedeni su opisani stvarni native i HTTP scenariji te provjere dokumentacije. Nema novog dependency audita; posljednja čista instalacija 2026-10-27 prijavila je 4 high nalaza.

Dokazi, screenshot, sintetički računi, PNG datoteke i pomoćne skripte ostaju u ignored local-data. Izvorna sintetička slika na telefonu uklonjena je u sklopu testa; osobne slike nisu odabrane niti mijenjane. Postojeće nepovezane promjene su sačuvane; nema commita/pusha.

## Sljedeći mali korak

Prekid aktivnog prijenosa i ponovni pokušaj te native eksplicitno preuzimanje fotografije za offline na drugom sintetičkom računu. Potom odbijene dozvole, ostali kodeci i preostala [beta matrica](PRIVATE_BETA.md). Faza 9 ostaje otvorena.
