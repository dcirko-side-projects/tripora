# Prva internetska beta — 2026-10-31

API je objavljen na [tripora-l4c7.onrender.com](https://tripora-l4c7.onrender.com). To je ASP.NET API, bez web sučelja; korisničko sučelje je mobilna aplikacija.

## Stvarna konfiguracija

- Render: servis `tripora`, Docker, Frankfurt, Free (0 USD, 0,1 CPU / 512 MB), repo `dcirko-side-projects/tripora`, grana `codex/offline-foundation`, izvorni commit `4890618feb00fcab4a64a0af21001bd66e29e795`.
- Dockerfile `services/api/Dockerfile`, build kontekst korijen repozitorija, port 8080, readiness `/health/ready`, automatski deploy isključen.
- Neon: zasebna baza `tripora`, PostgreSQL 17, Frankfurt, 0,25 CU i scale-to-zero 5 minuta. Izravni endpoint koristi `SSL Mode=VerifyFull` i `Channel Binding=Require`; startup je izvršio sve migracije uključujući `PlaceLocations`.
- Cloudinary Free: potpisani `authenticated` original i thumbnail, bez javnog/unsigned uploada.
- Brevo Free: verificirani pošiljatelj i ključ `Tripora API`, Restricted, samo Transactional email. Brevo za taj resurs nudi None/Read/All; All je najmanja ponuđena razina koja omogućuje slanje, a uključuje i upravljanje predlošcima/logovima. Ostali resursi ostaju None. Ključ istječe 2027-10-31 ili nakon 90 dana neaktivnosti.
- Postojeći PFX za šifriranje aplikacijskih ključeva prenesen je u Render; nije regeneriran. Data Protection ključevi trajno su u Neon bazi, šifrirani tim certifikatom. Potvrda emaila i provjere ovlasti ostaju obvezne.

Korisnik je izričito odobrio prijenos navedenih tajni u Render, stvaranje Brevo ključa i testnu poruku; zasebno je odobrio spremanje verificirane email adrese kao pošiljatelja. Nema unosa kartice ili plaćenog plana. Vjerodajnice nisu u repozitoriju niti mobilnom buildu. Privremene lokalne datoteke za transportne testove uklonjene su nakon izvršavanja; postojeći zaštitni certifikat ostaje u ignoriranoj lokalnoj mapi i treba siguran backup.

## Dokazi

1. Prvi deploy odbijen je zbog još nepoznatog `Tripora:PublicUrl`. Nakon što je Render dodijelio stvarni origin, varijabla je spremljena i novi deployment `dep-dbj16pl659jc739e6bn0` ima status **Deploy succeeded | Live**. Izvor se nije mijenjao.
2. Javni `/health/live` vraća 200 i Tripora.Api, `/health/ready` vraća 200 i ready. `/auth/options` vraća `requireConfirmedEmail: true`. Anonimni `/api/sync/pull`, `/auth/me` i `/api/media/{id}` vraćaju 401. Prvi probe koristio je nepostojeći `/api/account/options` (404); ispravan auth endpoint potom je potvrđen.
3. Render Events potvrđuje restart u 17:18 CET; readiness nakon restarta ponovno vraća 200. To nije dokaz obnove korisničke sesije jer hosted testni računi još nisu stvarani.
4. Brevo API prihvatio je jednu odobrenu testnu poruku s HTTP 201; stvarni Brevo zapisnik pokazuje **Delivered**. Brevo je freemail From prepisao na svoju brevosend.com adresu. Time nije dokazana dostava svim budućim primateljima ili aplikacijski confirmation/reset tok.
5. Postojeći Release `CloudinaryMediaFiles` adapter izvršio je stvarni upload originala i thumbnaila, ponovljeni upload istog ID-a i preuzimanje identičnih PNG bajtova. Anonimni Cloudinary URL vraća 401. Sintetički original i thumbnail potom su uklonjeni. Nije mijenjan adapter ni aplikacijski izvor.

Jednokratni nastavak nakon **17 minuta bez naših API zahtjeva** prolazi: 17:36:33 CET, readiness 200, 318 ms. Renderovi interni health zahtjevi nastavili su se bilježiti, a stvarno spavanje nije potvrđeno. Ovo je dokaz dostupnosti nakon neaktivnosti klijenta, ne izmjeren cold start. Nisu uvedeni keepalive pingovi ili trajna automatizacija.

## Android paket za internet

Izrađen je zaseban **Tripora Beta 11** APK: `local.tripora.beta`, versionCode 11 / versionName 0.1.0-beta11, release varijanta s postojećim razvojnim potpisom (privatni QA paket, nije izdanje za trgovinu). Izlaz je ignorirani `local-data/hosted-beta/Tripora-Beta-11.apk`. Drugi application ID omogućuje instalaciju uz stari `local.tripora.qa`; ne prepisuje njegovu lokalnu pohranu. Nema automatske migracije putovanja ili računa.

APK SHA-256: `78b7b130c7ba2eaa5acb7047b94be0d7df3dbed00f6cf1f93755ab7368c8e19e` (129.166.795 bajtova).

Gradle build prolazi: 406 zadataka, 78 izvršenih / 328 up-to-date. Prvi pokušaj koristio je drugi cache i pao na DNS dohvatu Mavena; ponovljeni offline build s postojećim workspace cacheom prolazi. Provjeren stvarni Hermes bundle: javni `https://tripora-l4c7.onrender.com` prisutan, QA `https://localhost:5443` odsutan. MapLibre biblioteke prisutne su za arm64-v8a, armeabi-v7a, x86 i x86_64. Manifest nema lokalni QA networkSecurityConfig i backup ostaje isključen. Objavljeni TypeScript izvor i ovisnosti odgovaraju buildu; Expo prebuild mijenja samo android/ios run skripte.

Prethodni QA10 APK i njegova native konfiguracija arhivirani su pod ignoriranim `local-data/hosted-beta/qa10-local`. Novi APK nije instaliran; build i pregled paketa nisu fizički test karte, prijave ili sinkronizacije.

## Preostali prihvat

Za ručni prihvat instalirati `Tripora-Beta-11.apk` kao zasebnu aplikaciju, uključiti internet i registrirati novi hosted račun vlastitim emailom/lozinkom. Lokalni QA račun nije cloud račun, čak i ako koristi isti email. Potvrditi primljeni email, stvoriti probno putovanje i u Mjestima odabrati Pronađi mjesto uz naziv i grad, potvrditi rezultat te provjeriti pin na karti. Zatim provjeriti pregled spremljenog popisa bez interneta. Nema unaprijed zadanih korisničkih lozinki.

- Potvrditi izmjereni cold start nakon neaktivnosti i zasebno višednevni nastavak unutar Free kvota.
- Instalirati pripremljeni mobilni beta APK i fizički provjeriti novu kartu, prijavu i sinkronizaciju. iPhone ostaje odgođen.
- Stvarna registracija/potvrda/reset, sesije nakon restarta i dva klijenta s koordinatama, konfliktima i uklanjanjem člana.
- Zajednički hosted backup/povrat Neon baze, privatnih fotografija i certifikata; lokalni backup nije cloud backup.

Free hosting može spavati ili stati nakon iscrpljenja kvota. Ova konfiguracija uklanja ovisnost API-ja o uključenom laptopu; ne daje jamstvo neprekinutog rada za tržišno izdanje.
