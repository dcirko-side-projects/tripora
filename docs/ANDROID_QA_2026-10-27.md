# Android — prvi native prihvat

Datum: 2026-10-27. Opseg: mali tok račun → putovanje → hladni start bez API-ja → offline unos → ponovno slanje, uz popravak pronađene greške tipkovnice.

## Uređaj i build

- Samsung Galaxy S25+ SM-S936B, Android 17/API 37, autorizirana USB veza.
- Zasebni paket `local.tripora.qa`, verzija 0.1.0/1, arm64, target SDK 36, ugrađeni Hermes bundle; Metro nije potreban.
- Ažurirani APK SHA-256: `f463ff488d5e9aafabda0d3b4fa233847dbfbce9a0c20e251d1b82808fedbc25`.
- Izvor je aktualni necommitani working tree. Sve datoteke QA src kopije i App.tsx podudaraju se s mobilnim izvorom. QA paket zadržava zasebni identitet, razvojni potpis i prethodno pripremljeni lokalni HTTPS certifikat.
- Lokalni HTTPS API preko USB porta 5443. Offline se simulira uklanjanjem tog prosljeđivanja; Wi-Fi/mobilna mreža nisu mijenjane. To ne predstavlja airplane-mode prihvat.

## Kriteriji i rezultat

| Korak | Očekivano | Stvarno |
|---|---|---|
| Registracija sintetičkog računa | Otvara se popis putovanja | PASS |
| Native kalendar i spremanje putovanja | Ispravni kalendarski datumi i sinkroniziran zapis | PASS; 27. 10. 2026. na uređaju i serveru |
| Uklonjen USB pristup API-ju, force-stop i ponovno otvaranje | Sesija i spremljeno putovanje ostaju dostupni | PASS; nema ponovne prijave, prikazana poruka o nedostupnom serveru |
| Novi offline zapis | Trajno spremljen i vidljivo čeka slanje | PASS; `QA-queued-20261027`, status 1 na čekanju |
| Force-stop i ponovno otvaranje bez API-ja | Novi zapis i red promjena ostaju sačuvani | PASS; isti zapis i 1 na čekanju |
| Povrat USB pristupa i ručna sinkronizacija | Red se prazni, zapis je na serveru | PASS; 0 na čekanju, 0 promjena treba pažnju |
| Ponovljena sinkronizacija | Nema dodatne kopije | PASS; neovisni autentificirani pull potvrđuje dva očekivana putovanja, svako jednom |
| Nadogradnja QA APK-a bez brisanja podataka | Ranija sesija i spremljeno putovanje ostaju | PASS za isti model/verziju baze; nadogradnja s neposlanim podacima i migracije nisu ovime potvrđene |

## Pronađena i ispravljena greška

Na početnom instaliranom buildu Back/zatvaranje Samsung tipkovnice zatvaralo je cijeli obrazac, uz gubitak nespremljenog unosa. Zajednički `FormSheet.onRequestClose` sada na Androidu prvo provjerava vidljivu tipkovnicu i zatvara je bez poziva zatvaranja obrasca. Kada tipkovnica nije vidljiva, postojeća obrada zatvaranja i zabrana tijekom aktivne operacije ostaju na snazi.

Fizička regresija na novom APK-u: unesen `QA-draft-back-check`; prvi Back skriva tipkovnicu i ostavlja tekst/obrazac, drugi Back zatvara obrazac. PASS. Proširena component provjera pokriva isti redoslijed i postojeće Android/iOS busy ponašanje; native dokazi navedeni ovdje odnose se samo na Samsung.

## Automatizirane provjere

- Mobilni `npm ci`, `npm run typecheck`, svih 71 testova, Android i iOS export: PASS.
- Android QA `assembleRelease`: PASS, 383 zadatka; instalacija `adb install -r`: Success.
- Prvi testni pokušaj imao je sandbox EPERM pri preimenovanju privremenih slika; sljedeći je imao razliku separatora TEMP putanje. Uz Windows TEMP/TMP `C:\Dev\SideProjects\tripora\local-data\test-temp` svih 71 testova prolazi. Nisu mijenjani testovi tih funkcionalnosti.
- Prvi Gradle pokušaj preklopio se s čistom instalacijom zajedničkog node_modules; ponovljen je nakon završene instalacije i prošao.
- Čista instalacija prijavljuje 4 high dependency nalaza. Nije proveden dependency popravak.
- API/auth-sync integracijski skup nije ponovno pokretan jer je promjena ograničena na mobilni modal. Provjera stvarnog API-ja potvrđuje točne zapise poslane s uređaja.

Privatne vjerodajnice, izlazi testova, UI snimke, APK i skripte ostaju u ignored local-data. Nema stvarnih putnih podataka ni osobnih fotografija u testu. Nema commita/pusha.

## Sljedeći korak

Na Androidu dodati sintetičku fotografiju, provjeriti dozvole/otkazivanje galerije, trajnu lokalnu sliku i ponovno otvaranje bez API-ja. Zatim airplane mode, prekidi prijenosa, nizak prostor, veći tekst/pristupačnost, nadogradnja s redom promjena te iPhone i stvarni rad na dva uređaja prema [privatnoj beti](PRIVATE_BETA.md). Faza 9 ostaje otvorena.
