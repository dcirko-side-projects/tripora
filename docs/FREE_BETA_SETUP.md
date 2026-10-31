# Besplatna internetska beta — priprema i korisnikovi koraci

**Aktualno 2026-10-31:** ovo je povijesna Supabase priprema. Korisnik sada zahtijeva hosting bez bankovne kartice i automatski nastavak; nova konfiguracija i registracija su u [NO_CARD_SETUP.md](NO_CARD_SETUP.md). Životni ciklus računa i Brevo pravila ostaju. Ne primjenjivati Supabase SQL na Neon projekt.

Datum provjere uvjeta: 2026-10-30. Korisnik je odabrao 0 troška, internet dostupnost te Render/Supabase/Brevo. Kod i lokalni testovi su pripremljeni; stvarni računi, tajne i deployment još nisu postavljeni. Ne birati plaćeni plan ili dodatak.

## Ograničenja

- Render Free uspavljuje API nakon 15 minuta neaktivnosti; buđenje može potrajati oko minute. Disk je prolazan, pa se na njemu ne spremaju trajne fotografije/ključevi. SMTP portovi su blokirani; email adapter koristi HTTPS. Render taj plan opisuje kao prikladan za probu/hobi, ne produkcijsko jamstvo. [Službeni uvjeti](https://render.com/docs/free).
- Supabase Free: 500 MB baze, 1 GB datoteka, 5 GB osnovnog egressa; projekti se mogu pauzirati nakon tjedna neaktivnosti. [Plan](https://supabase.com/pricing).
- Brevo Free: 300 poruka dnevno. Verificirani pošiljatelj je obavezan; stvarnu dostavu tek treba provjeriti. Bez vlastite domene mogući su zamjena adrese, spam ili odbijanje. Ne pretpostavljati pouzdanu besplatnu dostavu samo zato što je API zahtjev prihvaćen. [Free limit](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [verifikacija pošiljatelja](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [zahtjevi dostavljivosti](https://help.brevo.com/hc/en-us/articles/14925263522578).

Ako besplatna sender konfiguracija ne prođe stvarni test, ne kupujemo domenu i ne gasimo potvrdu emaila da sakrijemo problem. Javna registracija ostaje neobjavljena dok ne dogovorimo valjanu besplatnu dostavu ili promjenu opsega.

## 1. Supabase

Otvoriti poseban Free projekt samo za Triporu. Ne unositi njegove tajne u chat ili mobilnu aplikaciju.

1. U SQL editoru izvršiti [zatvaranje javnog Data API pristupa](../deploy/supabase-private-database.sql) **prije API migracija**. ASP.NET Identity tablice ne smiju biti javno dostupne kroz Supabase REST. Ovaj SQL nije za projekt koji već dijeli druge aplikacije.
2. Izvršiti [privatni storage SQL](../deploy/supabase-storage.sql). Bucket tripora-private ostaje public=false, PNG, najviše 8 MiB po objektu. Ne dodavati javne/anon politike.
3. Iz Connect dijaloga kopirati **Session pooler** host/korisnika na portu 5432; ne izmišljati adresu i ne birati plaćeni IPv4 dodatak. [Načini povezivanja](https://supabase.com/docs/guides/database/connecting-to-postgres).
4. Serverski connection string koristi SSL Mode=VerifyFull. Servisni legacy service_role ključ ide samo u serversku tajnu Tripora__Storage__ServiceKey. Projekt URL nije dovoljan za autorizaciju; API i dalje provjerava članstvo/autora pri svakom pristupu.

## 2. Brevo

Otvoriti Free račun, proći eventualnu aktivaciju transactional slanja i verificirati email pošiljatelja. Spremiti sender adresu i transactional API key kao serverske tajne. Kod koristi POST /v3/smtp/email, ne SMTP niti marketinšku kampanju. [API ugovor](https://developers.brevo.com/reference/send-transac-email).

Provjeriti stvarnu potvrdu i reset na kontroliranom vlastitom računu te dostavu u inbox/spam. Nije poslano ništa stvarnim primateljima u lokalnoj provjeri.

## 3. Ključevi

Pokrenuti iz repo root-a:

```powershell
./deploy/create-key-certificate.ps1
```

Generator odbija prepisivanje. Privatni PFX, base64 vrijednost i lozinka ostaju u ignored local-data/hosted-beta. Base64/PFX lozinka postavljaju se kroz Render secrets; nisu TLS certifikat web domene. Ne regenerirati nakon deploya bez postupka rotacije/starih certifikata: postojeći tokeni i email kodovi ovise o tim ključevima. Čuvati ih s budućim backupom baze i objekata.

## 4. Render

Nakon pregleda izvora i korisnikove autorizacije za commit/push, povezati odgovarajuću Git granu. Main trenutno ne treba pretpostaviti ažurnim. [render.yaml](../render.yaml) bira Free plan i isključuje automatski deployment. [Službeni blueprint format](https://render.com/docs/blueprint-spec).

U dashboardu popuniti tajne iz [predloška](../deploy/.env.example): public Render HTTPS origin, PostgreSQL connection string, Supabase URL/bucket/service key, Brevo sender/key te certifikat/lozinku. Ne dodavati te vrijednosti u Git.

Kontejner radi kao non-root, sluša na 8080 i izvršava EF migracije prije pokretanja. Startup odbija nepotpunu hostanu konfiguraciju, nepotvrđeni-email način, neprovjeren DB TLS, javni bucket ili izloženu aplikacijsku shemu. Readiness /health/ready potvrđuje dostupnu migriranu bazu; ne vraća podatke putovanja.

## 5. Mobilni beta build

Postaviti EXPO_PUBLIC_API_URL na stvarni Render HTTPS origin prije builda. To mijenja account scope: lokalni razvojni podaci ne šalju se automatski na novi server. Ne kopirati razvojnu bazu/osobne fotografije u cloud bez zasebne odluke.

Ikona je u apps/mobile/assets, originalni SVG u assets/brand/mark.svg. `npm run branding --prefix apps/mobile` reproducira PNG-ove. Instalirani QA paket local.tripora.qa ima zaseban razvojni potpis; produkcijsku distribuciju i signing tek treba pripremiti. Expo export nije instalacijski ni fizički test.

## 6. Prije prihvata internetske bete

- [ ] Stvarni endpoint, sender i private bucket provjereni; nijedna tajna nije u APK-u.
- [ ] Potvrda/reset emaila na uređaju i stari tokeni nakon reseta odbijeni.
- [ ] Dva sintetička klijenta: retry, konflikti, brisanja, revocation i privatne slike preko stvarne mreže/free cold starta.
- [ ] Provjeren zajednički hosted backup/povrat baze, fotografija i key certifikata; raspored/retencija dogovoreni. Postojeći [lokalni backup](PRIVATE_BETA.md) kopira zaustavljeni lokalni PostgreSQL, ne upravljanu Supabase bazu.
- [ ] Poznate kvote i postupak nastavka nakon pauziranja ili nedostupnosti. Podaci ostaju lokalno kad server/spremište ne rade.
- [ ] Hosted CI stvarno izvršen nakon autoriziranog pusha. Lokalni testovi ne dokazuju da je objava prošla.

Trenutačni dokaz i daljnje faze: [STATUS.md](STATUS.md), [RELEASE_PHASES.md](RELEASE_PHASES.md).
