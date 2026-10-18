# Nastavak Tripore na novom laptopu

Datum: 2026-10-18. Ovaj dokument zamjenjuje potrebu za prethodnim Codex chatom.

## Preuzimanje

Najnoviji razvoj je na grani `codex/offline-foundation`. `main` sadrži početnu dokumentaciju.

```sh
git clone --branch codex/offline-foundation https://github.com/dcirko-side-projects/tripora.git
cd tripora
```

Repo je samostalan: na novom laptopu nije potreban roditeljski legacy folder niti stari .NET projekt.
Ako je repo privatan, GitHub pristup mora biti prijavljen na račun s dozvolom.

## Obavezno pročitati

1. AGENTS.md — način rada i provjere.
2. PRD.md — potvrđeni zahtjevi proizvoda.
3. docs/STATUS.md — stvarno stanje i otvoreni posao.
4. docs/decisions/0001-auth-sync.md — novi auth/sync smjer.
5. Architecture.md i Architecture-essentials.md — arhitektura i pravila.
6. docs/TRIPORA_PLAN.md i docs/AUTH_SYNC_CHECKLIST.md — faze, ne dokaz dovršenosti.

## Što postoji

- Expo SDK 57 / React Native / TypeScript mobilni prototip.
- Trenutni App.tsx još koristi anonimni localStore/database prototip: kreiranje i popis putovanja.
- Novi moduli accountStore, accountDatabase, sessionClient, session i sync su pripremljeni, ali još NISU spojeni na App.tsx.
- ASP.NET Core Identity s registracijom, prijavom, refreshom, /auth/me i /auth/revoke-all.
- EF Core + PostgreSQL migracija i zaštićeni trip-only push/pull.
- Stable operation ID, potvrde obrade, verzije, tombstones i cursor pagination.
- Samo vlasnik pristupa putovanju; članstvo/pozivnice još nisu implementirani.
- Nema cloud deploymenta, potvrde emaila, oporavka računa, slika ni production releasea.
- API namjerno odbija production pokretanje dok auth/recovery ne budu dovršeni.

## Lokalno pokretanje i provjere

Potrebni su Git, Node 22.13+ i .NET 10 SDK. Nije potrebna globalna Expo instalacija.

```sh
npm ci --prefix apps/mobile
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
dotnet tool restore
dotnet build services/api/Tripora.Api.csproj --configuration Release
node tests/e2e/api-health.mjs
npm ci --prefix tests/e2e
node tests/e2e/auth-sync.mjs
```

Posljednji test pokreće izolirani PostgreSQL 17 s nasumičnim testnim lozinkama, primjenjuje migracije,
provjerava stvarne HTTP tokove i zaustavlja bazu. Ne treba Docker i ne koristi osobne podatke.
Može trebati dozvolu za lokalne procese i preuzimanje binarnih paketa.
Mobilne testove zasad pokriva 7 testova starog localStore-a; novi auth/sync klijent još nema zasebnu testnu pokrivenost.

Mobilni UI:

```sh
npm start --prefix apps/mobile
```

Na starom laptopu roaming npm prečac bio je pokvaren; `C:\Program Files\nodejs\npm.cmd` radio je.
To nije nužno problem novog laptopa. Ne mijenjati sistemske postavke ako obični npm radi.

## Trajna razvojna baza (opcionalno)

compose.yaml daje PostgreSQL na loopback portu 55432. Lozinku postaviti u procesnu varijablu
TRIPORA_DB_PASSWORD, a connection string u ConnectionStrings__Tripora ili .NET User Secrets.
Ne commitati lozinke, .env ili connection stringove. Nakon `docker compose up -d db`:

```sh
dotnet ef database update --project services/api/Tripora.Api.csproj
dotnet run --project services/api/Tripora.Api.csproj
```

Pri migraciji postaviti ASPNETCORE_ENVIRONMENT=Development. API koristi development launch profile i port 5080.
Za samo liveness bez baze postaviti Tripora__HealthOnly=true.
Stari laptop nije mogao pokrenuti Docker engine, zato je korišten embedded PostgreSQL za testove.

## Što treba prvo dovršiti

1. Testirati nove account/session/sync module: retry nakon izgubljene potvrde, token expiry, izolacija računa,
   dirty-record pull, konkurentna sinkronizacija i eksplicitno rješavanje konflikata.
2. Spojiti prijavu/registraciju, obnavljanje sesije, odjavu i account-scoped bazu na mobilni UI.
3. Spojiti sinkronizaciju i prikaz pending/error/conflict stanja. Ne prepisivati lokalne promjene.
4. Ažurirati CI za auth/sync testove i dokumentaciju nakon stvarne verifikacije.
5. Tek zatim članovi i pozivnice, pa ostale sekcije prema roadmapu.

Provjeru na fizičkom Androidu/iPhoneu korisnik je IZRIČITO odgodio. Bundle export nije device test.
Ne prenositi podatke iz tripora-prototype.db u korisnički račun bez eksplicitne odluke.
Ne počinjati ispočetka, ne stvarati novi repo i ne mijenjati stack bez razloga.

## Prompt za novi Codex chat

> Nastavljamo Triporu iz ovog repozitorija na grani codex/offline-foundation. Pročitaj AGENTS.md,
> docs/NEW_LAPTOP_HANDOFF.md, docs/STATUS.md, PRD.md i arhitekturu. Pregledaj aktualni kod i Git stanje.
> Dovrši započete dvije faze: mobilnu autentifikaciju/izolaciju računa i zaštićenu trip sinkronizaciju.
> Backend auth/sync već postoji; mobilni moduli još nisu povezani s App.tsx. Radi u malim provjerenim
> koracima, ažuriraj checklistu i na kraju navedi rezultate i sljedeće faze. Test uređaja zasad je odgođen.
