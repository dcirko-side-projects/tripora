# Pregled pripreme za prvu internetsku objavu

Datum: 2026-10-31. Status: **kod je commitan i pushan na razvojnu granu**; Render servis još nije kreiran. Postojeći drugi Render servis ostaje netaknut.

## Izvor i grana

- Repozitorij: dcirko-side-projects/tripora.
- Namijenjena grana: **codex/offline-foundation**; main ostaje bez promjena.
- Pročitano stvarno udaljeno stanje: razvojna grana još je na `facf141`, main na `b8397cd`. Nove funkcionalnosti nisu na GitHubu.
- Pregledano je 130 promijenjenih/novih datoteka prije dodavanja ovog pregleda. Kandidat obuhvaća dosadašnji razvojni checkpoint: mobilni UI/redizajn i karta, offline mjesta/plan/troškovi/uspomene, API/auth/email/brisanje računa, ovlasti/sync/migracije, testovi, hosting konfiguracija i dokumentacija.
- Korisnik je naknadno odobrio sve promjene, uključujući **AGENTS.md** s aktualnim naredbama provjera. Ne šaljemo legacy roditeljski kod niti njegovu povijest.
- Dva binarna kandidata su generirane launcher ikone; nema osobnih fotografija.

## Provjere prije zahtjeva za objavu

Raniji završni funkcionalni krug: 83 mobilna testa, 48 PostgreSQL/HTTP scenarija, TypeScript, Android/iOS izvozi, Release API build/liveness, backup guard i QA10 native Android build. Ovaj konfiguracijski korak nije ponavljao testove jer nije mijenjao aplikacijski kod. Fizički prihvat nove karte i stvarni cloud prihvat ostaju otvoreni.

Provjeren aktualni git diff --check. Ograničeni pregled kandidata nije pronašao uobičajene formate Brevo/Neon/GitHub/private-key tajni niti runtime izlaze (`local-data`, baze, PFX/PEM, APK). To je pomoćna provjera, ne jamstvo potpunog secret audita. Pružateljevi ključevi i connection stringovi još nisu kopirani u izvor. Docker kontekst isključuje lokalne podatke i tajne.

## Render konfiguracija koja slijedi nakon dostupnosti koda

| Postavka | Namijenjena vrijednost |
| --- | --- |
| Service type | Web Service |
| Name | tripora-beta, ako je slobodno |
| Source branch | codex/offline-foundation |
| Runtime | Docker |
| Dockerfile | services/api/Dockerfile, kontekst repo root |
| Region | Frankfurt |
| Instance | Free |
| Auto deploy | Off |
| Health check | /health/ready |
| Database | Postojeći zasebni Neon Tripora / tripora, PostgreSQL 17 |
| Private photos | Postojeće Cloudinary Free okruženje, authenticated upload |
| Email | Postojeći Brevo račun/potvrđeni sender; stvarna dostava još nije testirana |

Render sada vidi samo ranije povezane repozitorije drugog GitHub vlasnika. Za Triporu korisnik treba odobriti Render GitHub aplikaciji pristup **samo** `dcirko-side-projects/tripora` u odgovarajućoj organizaciji. Ne širiti pristup na sve repozitorije i ne uklanjati postojeće integracije drugih aplikacija. Ako organizacija ili tražene dozvole nisu dostupne/očekivane, stati i pregledati taj ekran s korisnikom.

Tajne se naknadno unose izravno u Render environment/secrets. Ovaj commit/push ne uključuje vjerodajnice i sam po sebi ne objavljuje funkcionalni API. Ne koristiti stari main niti ručno isključivati TLS, email potvrdu ili provjeru ovlasti kako bi deployment prošao. Ne birati plaćeni plan ili unositi karticu.

Nakon stvarnog deploymenta slijede readiness, email/reset, anonimno odbijanje privatnih slika, sintetička dva klijenta, buđenje nakon neaktivnosti i novi mobilni build sa stvarnim HTTPS endpointom. Do tada aplikacija nije laptop-neovisna.

Korisnik je potvrdio da je repozitorij učinio javnim i da će ga sam povezati s Renderom. Commit opis i sažetak README-a su na engleskom. Za Render izabrati razvojnu granu codex/offline-foundation; main nije izvor ovog checkpointa.

Objavljeno: `0b1b3b294b63551cccc9ac5b063daad6a0bb3ffe`, 132 datoteke, engleski commit opis. GitHub remote head potvrđen jednakim lokalnom commitu; main ostaje b8397cd. Render servis i tajne još nisu povezani.
