# Redizajn i dostupnost servera — 2026-10-31

## Kriteriji prije izmjena

- Primijeniti #0593C6 / #FCFFFF / #D83995 kroz zajedničke kontrole, kartice, hijerarhiju i navigaciju; mobilni prikaz ostaje prioritet.
- Sačuvati postojeće tokove, kategorije, podatke i API/sync ugovore. Kartu samo istražiti.
- Provjeriti lokalni endpoint i uzrok nedostupnosti, ne zamijeniti ga drugim serverom/account scopeom.
- Provjeriti spor odgovor, timeout, mrežni prekid i obnovu sesije uz sačuvane podatke i bez automatskog dupliciranja POST-a.

## Vizualne promjene

Blago plavosiva pozadina odvaja svijetle kartice; plavi paneli uvode prijavu/pregled, ružičasti panel ističe troškove, a odabrana navigacija ima ružičastu podlogu i tamnu oznaku. Kartice putovanja imaju obojeni rub, mekše kutove i odvojenu destinaciju/naziv/datum/status. Zajednički gumbi, filteri, meniji i modali koriste istu temu. Dnevni odabir, packing indikatori i izvorna SVG/PNG launcher ikona usklađeni su. Dodirne kontrole zadržavaju postojeće minimalne veličine; nema fiksne visine teksta u novim panelima.

Kontrast je izračunat iz sRGB luminancije: bijela na #0593C6 je samo približno 3,48:1 pa nije korištena za mali tekst gumba. Tamni tekst gumba #001E2B prelazi 4,5:1 na toj plavoj; plavi tekst #00658A na #DEF3FA ima 5,67:1, ružičasti tekst #A21E6B na #FCEAF4 6,21:1, sekundarni tekst na pozadini 5,30:1. To provjerava odabrane parove, ne predstavlja puni accessibility audit. Disabled kontrole imaju postojeću smanjenu opacity.

## Nalaz servera

Početna provjera izvan sandboxa: TCP 5080, 5443 i 8081 odbijaju vezu (ECONNREFUSED). PostgreSQL proces ne radi. Prethodna QA dokumentacija i wrapper pokazuju razvojni https://localhost:5443, preko USB reversea na računalo. Nema postavljenog internetskog deploymenta ni javnog API endpointa u konfiguraciji projekta. Povijesnu jučerašnju grešku nije moguće pripisati jednom događaju bez tadašnjeg zapisa; sadašnja nedostupnost je izravno potvrđena.

Prvi pokušaj pokretanja sigurno odbija zaostalu local-data/development.lock (PID 21196). Potvrđeno je da PID više ne postoji i da nema PostgreSQL procesa. Samo ta brava arhivirana je u ignored local-data/development-stale-20261031.lock; podaci, postmaster.pid i ključevi nisu ručno uklanjani. Runner zatim uspješno pokreće postojeću bazu, migracije, API i Expo. Pokrenut je i postojeći QA HTTPS wrapper s istim certifikatom/bazom/ključevima. Nisu otkrivene niti zapisane tajne u ovom izvještaju.

Završno: HTTP 5080 i certifikatom provjeren HTTPS 5443 vraćaju readiness 200 pet puta uzastopno; anonimni HTTPS /auth/me vraća 401. Launcher je dostupan na razvojnoj LAN adresi zapisanoj u ignored links.json. Razvojni procesi ostavljeni su pokrenuti; to nije OS servis, automatsko pokretanje nakon restarta niti internetski hosting. USB reverse i dohvat s telefona nisu u ovoj rundi provjereni.

Zaseban potvrđeni nedostatak koda: stari fetch timeout od 15 sekundi kraći je od očekivanog Render Free buđenja i nije obuhvaćao čitanje tijela. Novi AbortController obuhvaća zahtjev i response.text() do 75 sekundi te se timer uvijek čisti. Poruke razlikuju istek čekanja od mrežnog prekida; prikaz obrade objašnjava moguće čekanje. Nema automatskog ponavljanja proizvoljnog POST-a. Postojeći sync ponovno šalje iste nepromjenjive operation ID-eve, čuva red i pokušava u foregroundu svakih 30 sekundi te pri povratku u aplikaciju. Generacijske zaštite sesije ostaju.

Ograničenje: postojeća globalna busy brava i dalje može odgoditi uređivanje dok traje sinkronizacija. Povećanje timeouta olakšava cold start, ali nije jamstvo dostupnosti niti rješenje ugašenog računala, krive adrese, nepouzdanog USB-a ili pauzirane cloud baze.

## Neaktivnost i hosting

Render Free se uspavljuje nakon 15 minuta i obično se automatski budi oko minute na novi zahtjev. Supabase Free može se pauzirati nakon tjedna neaktivnosti. Stalna dostupnost bez intervencije ne može se jamčiti tim planovima; potrebno je dovršiti već odabranu hosted konfiguraciju i prihvat, uz poznate granice ili zasebno dogovoren drugačiji budžet. Nisu uvedeni plaćeni resursi, keepalive poslovi, OS autostart ni promjena mobilnog endpointa. [Render uvjeti](https://render.com/docs/free), [Supabase plan](https://supabase.com/pricing), [postojeća priprema](FREE_BETA_SETUP.md).

## Dokaz i granice

- Čista mobilna instalacija iz lockfilea; TypeScript; svih 80 mobilnih testova; Android i iOS izvozi.
- Tri nove regresije: odgovor nakon virtualnih 60 sekundi bez replaya; zastoj tijela do timeouta i kasniji uspješan retry; prekid refresha nakon isteka sesije i oporavak bez gubitka spremljenih vjerodajnica. Virtualno vrijeme nije stvarni cloud cold start.
- Release API build: bez grešaka/upozorenja. HTTP liveness smoke prolazi.
- Svih 43 PostgreSQL/HTTP scenarija i cleanup prolaze nakon oporavka zaostale brave. Obuhvaćeni restart/persistence, retries, konflikti, brisanja, pristup, privatni mediji i hosted konfiguracijske zaštite.
- Backup guard prolazi na ponovnom pokušaju. Prvi pokušaj imao je Windows EPERM pri preimenovanju privremene testne mape; integracijski backup/restore potom također prolazi. Kod backupa nije mijenjan.
- npm ci prijavljuje 2 low i 10 moderate nalaza; nema high/critical. Nije pokrenut prisilni dependency upgrade.
- Relativne dokumentacijske poveznice i git diff --check provjereni prije predaje.
- Nisu provedeni nova APK instalacija, fizički Android/iPhone pregled redizajna, stvarni Render cold start, internetski višednevni uptime ni stvarna email dostava. Izvozi nisu fizički testovi. Stara instalirana QA9 verzija ne preuzima ove izmjene sama.

Sljedeće: fizički prihvat nove teme i priprema odgovarajućeg instalacijskog builda; korisnikova konfiguracija već odabranih besplatnih servisa prema FREE_BETA_SETUP te stvarni HTTPS/cold-start prihvat. Za kartu prvo dogovoriti prioritet automatske pretrage, prava offline pohrane i provider/budžet prema [istraživanju](MAP_RESEARCH.md). Nema commita, pusha ni objave.
