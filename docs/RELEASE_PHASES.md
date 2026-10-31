# Tripora — preostale faze do izdanja

Aktualno 2026-10-31 — korisnik je odobrio i implementirani su pretraga mjesta po nazivu/gradu, odabir rezultata, koordinate kroz offline sync i native MapLibre karta. Prolaze 83 mobilna / 48 HTTP scenarija te QA10 Android build; APK nije instaliran/fizički prihvaćen. Zahtjev je 0 € bez bankovne kartice i bez laptopa: pripremljen Render/Neon/Cloudinary/Brevo; korisnik nema račune i tražio je [korake registracije](NO_CARD_SETUP.md). Nema stvarnog deploymenta. [Odluka 0005](decisions/0005-maps-and-no-card-beta.md) i [STATUS](STATUS.md) zamjenjuju raniji research-only/Supabase checkpoint.

Ažurirano 2026-10-30. Ovo su release faze iz razgovora; ne prenumeriraju izvorni razvojni plan. iPhone je odgođen, a Android ima raniji ograničeni device prihvat.

## 1. Stabilizacija i sigurnost

- [x] Četiri high dependency nalaza uklonjena: node-forge 1.4.2, ograničeni Expo CLI Zod override 4.6.6, Expo SDK ostaje 57. Dodana provjera stvarnih CLI dev-tool shema. Čisti npm ci/audit potvrđuje 0 high/critical; ostaje 8 low nalaza.
- [x] TypeScript, 77 mobilnih testova, oba izvoza, API Release/liveness, backup guard i 43 PostgreSQL/HTTP scenarija prolaze, uključujući završni cleanup.
- [x] Posebno provjeren restart Linux kontejnera u 512 MiB, trajni šifrirani ključevi i prijava. Ovo je lokalni Docker test, ne Render deployment.
- [x] Originalna ikona kofera s avionom, adaptive mask margine, SecureStore config i isključen Android auto-backup. QA9 nadogradnja čuva prijavu/putovanje; ikona fizički provjerena na Samsung launcheru.
- [ ] Riješiti preostalih 8 low nalaza kad postoji kompatibilna zakrpa; ne koristiti audit fix --force/downgrade SDK-a.
- [ ] Stvarni fizički ENOSPC i LAN permission-denial ostaju granice ranijeg Android kruga. Nisu zamijenjeni bundlingom ili ponovnim tvrdnjama o PASS-u.

## 2. Računi

- [x] Potvrda emaila, ponovno slanje, anonimni zahtjev za oporavak i kod za novu lozinku; native obrasci i postojeći Identity token provider, rok koda jedan sat.
- [x] Reset poništava stare pristupne/refresh tokene; pogrešan/ponovljen kod odbijen. Zahtjev za nepoznati email vraća neutralan odgovor bez poruke.
- [x] Dogovoreno brisanje uz lozinku, frazu i dodatnu potvrdu, sinkronizirane tombstoneove i povrat lokalne kopije bez oživljavanja. Na ovom uređaju pokušava se obrisati i zatvorena SQLite/media pohrana, uz vidljivu poruku ako OS čišćenje ne uspije.
- [x] Izbrisani email može se ponovno registrirati samo kao novi identitet bez starih putovanja. Ukinut pristup ne vraća se ako fizičko čišćenje fotografije traži retry.
- [ ] Stvarna Brevo dostava i cijeli native tok preko internetske beta adrese trebaju korisnikove servisne račune i verificiranog pošiljatelja. Dosad su poruke isključivo sintetičke/lokalne.

## 3. Besplatna internetska beta

- [x] Odabir korisnika: Render Free + Supabase Free + Brevo Free, bez kupnje domene ili plaćenog plana.
- [x] Dockerfile/start migracije, Render blueprint, readiness, privatni bucket, Data API isolation SQL, konfiguracijski predložak i generator certifikata za ključeve.
- [x] Privatni storage HTTP ugovor, prekinut thumbnail/retry, preuzimanje/restart, paginirano čišćenje 101 starog objekta i zaštite od javnog bucketa/sheme provjereni na lokalnom servisu. To nije test stvarnog Supabase projekta.
- [ ] Korisnik otvara račune i postavlja tajne po [uputama](FREE_BETA_SETUP.md); izvor mora biti pregledan/commit/pushan uz korisnikovu autorizaciju prije Render povezivanja. Ništa još nije objavljeno.
- [ ] Stvarni HTTPS deployment, dostava emaila, dva klijenta preko interneta i provjera ograničenja free planova.
- [ ] Zajednički hosted logički backup PostgreSQL-a, privatnih objekata i certifikata te provjeren povrat. Lokalni hladni backup alat nije backup Supabase clustera.
- [ ] Operativni postupak za kvote, pauziranje/free cold start, neuspjelu dostavu i periodičko čišćenje ako nema aktivnih klijenata.

## 4. Privatna beta

Android distribucija, više stvarnih korisnika/uređaja, probno putovanje, nadogradnja s neposlanim radom i popravak pronađenih grešaka. iPhone/dva različita mobilna sustava kad budu dostupni.

## 5. Priprema izdanja

Zaključiti v1, privatni APK ili Google Play, završni UX/accessibility pregled, pravila privatnosti/brisanja i potpisani release. QA debug potpis nije produkcijski signing key.

## 6. Izdavanje i održavanje

Ponovljiv release, praćenje grešaka/dostupnosti i pohrane, redovite nadogradnje, backup/povrat. Desktop/web prioritet ostaje zasebna odluka.
