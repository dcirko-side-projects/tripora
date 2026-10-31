# Android — završni dostupni QA krug

Datum: 2026-10-29. Korisnik je zatražio dovršetak Android provjera i izričito odgodio današnju iPhone provjeru. Samsung Galaxy S25+ (SM-S936B, Android 17/API 37), sintetički računi i podaci. Ovo zatvara preostali dostupni krug na ovom uređaju uz niže navedene granice; nije prihvat svih Android modela, višednevne bete ili iPhonea.

## Kriteriji i rezultati

| Scenarij | Rezultat | Dokaz / granica |
| --- | --- | --- |
| Ranije sačuvan članski trošak | PASS | Native odjava vlasnika/prijava istog člana prenijela je jedan QA-native-expense, 1234 minor units, nepromijenjenog autora. UI pokazuje 12,34 EUR potrošeno i 987,66 EUR preostalo od 1000 EUR. Ponovljeni API upit i dalje vraća jedan zapis. |
| Offline konflikt plana | PASS | Zasebna aktivnost: član mijenja offline, vlasnik konkurentno preko API-ja. Native ekran prikazuje obje verzije i čuva lokalni red. Force-stop/restart čuva konflikt. |
| Lokalni izbor konflikta | PASS | Prikazana potvrda ponovnog slanja lokalne verzije; API potom potvrđuje isti entry ID, lokalni naslov i novu verziju, red=0. |
| Serverski izbor konflikta | PASS | Drugi konflikt, izričiti Prihvati serverski zapis/Potvrdi; API potvrđuje noviji serverski naslov, isti ID, bez duplikata. |
| Brisanje nasuprot offline izmjeni | PASS | Native prikazuje lokalnu verziju i serversko Brisanje. Nema Zadrži moj zapis. Potvrda serverskog izbora čuva tombstone; ponovljeni API upit potvrđuje deleted=true. |
| Manjak prostora za fotografiju | PASS — simulacija | Privremeni ignored QA6 koristi 1 bajt kao raspoloživ prostor samo na ulazu stvarne native provjere. Picker vraća sintetički WebP; obrazac javlja nedostatak prostora, čuva naslov i ne prijavljuje spremljenu fotografiju. Tekst i naknadno unesena bilješka spremljeni su jednom, mediaId=null. Stvarni disk telefona nije punjen. |
| Greška transakcije / thumbnaila | PASS — automatizirano | Tri ponovno izvedena storage/overview/native-adapter testa uključuju simulirani disk-full/ENOSPC i očuvanje prethodnih podataka/redova. To nije stvarni fizički ENOSPC. |
| Povrat normalnog builda | PASS | QA7 uklanja simulaciju, odgovara aplikacijskom nativeMedia.ts i nadograđuje instalaciju bez brisanja podataka. Isti tekstualni zapis ostaje dostupan za daljnji foto test. |
| WebP i HEIC | PASS — uzorci | Generirani 640×400 RGB uzorci, stvarni picker i priprema, upload privatnih PNG kopija 640×400 / 320×200, provjereni hashovi. WebP pa HEIC na istoj uspomeni čuvaju ID/naslov/bilješku. To potvrđuje ove datoteke kroz Android picker, ne sve profile/kodeke ni izostanak picker transkodiranja. PNG i JPEG/EXIF dokaz je u ranijem izvještaju. |
| Trajnost posljednje fotografije | PASS | Uklonjene samo današnje sintetičke WebP/HEIC picker kopije. Bez QA API tunela, nakon force-stop/cold starta puna HEIC-pripremljena slika, naslov i bilješka ostaju vidljivi. Screenshot vizualno pregledan. Radio nije mijenjan; raniji airplane-mode dokaz ostaje zaseban. |
| Veći tekst i obrazac | PASS — pregled | Font 1.5: pregled troškova, točni iznosi, prelamanje kategorija, navigacija i obrazac troška vizualno pregledani. Raniji packing 1.15/1.5 i native keyboard Back prihvat ostaju važeći. Ovo nije potpuni audit svih skala/ekrana. |
| TalkBack | PASS — osnovni test | Potvrđeni aktivni servis/touch exploration, rad QA aplikacije, otvaranje obrasca i plavi fokus polja pri Tab navigaciji. Screenshot vizualno pregledan. Tijekom testa koristiti screenshotove: UIAutomator dump ometa servis i njegov onboarding, pa takvi pokušaji nisu brojeni. Govorna razumljivost i potpuni gesture audit nisu zasebno ocijenjeni. |
| Galerijske dozvole | N/A za opću dozvolu | Instalirani paket nema opću READ_MEDIA_IMAGES dozvolu; sustavski picker daje izričiti odabir pojedine datoteke. Stvarni odabir/odustajanje provjereni su. Ne proglašavati odbijanje nepostojeće dozvole provjerenim. |
| Odbijena lokalna mreža | Ograničen dokaz | pm revoke nije promijenio učinkoviti grant na ovom paketu. Privremeni UID app-op ignore uz USB localhost vezu nije dokaz odbijanja stvarnog LAN zahtjeva. Lokalne kopije/app ostale su dostupne. Vraćeni grant i učinkoviti ACCESS_LOCAL_NETWORK allow potvrđeni su; LAN denial ostaje zaseban test ako se taj razvojni način koristi. |

## Identitet i završno stanje

- Konačni paket: local.tripora.qa, versionCode=7, versionName=0.1.0-qa7. `assembleRelease` i `adb install -r` prolaze. APK SHA-256: `224a8b964b3a6e0a621037b7eecb8cc2210fd4b373a39019f964e2636fc57698`.
- QA6 simulacija postoji samo u ignored APK-u/arhivi testa; nije u proizvodnom izvoru. Konačni QA7 nativeMedia.ts hash jednak je aplikacijskom izvoru. Nema nove sheme, API ugovora ili novog funkcionalnog koda u ovom krugu.
- Potvrđen povrat: font=1.15, airplane=0, USB stay-awake=0, accessibility_enabled=0, enabled_accessibility_services=null, učinkoviti lokalni mrežni app-op=allow i izravni adb reverse 5443→5443.
- Sintetički trošak/uspomena ostaju jednom na API-ju, konfliktna aktivnost ostaje obrisana. Postojeći lokalni rad nije brisan. Tijekom prvog pokušaja konflikta keep-alive je zadržao vezu; pokušaj nije brojen. Valjani pokušaji koristili su force-stop prije offline otvaranja. USB je jednom zahtijevao korisnikovo ponovno povezivanje.
- Završna ručna sinkronizacija na normalnom QA7: 0 na čekanju, 0 promjena treba pažnju, Nema prijavljenih problema (android-final-clean-sync.json). Provjereno je 50 relativnih poveznica u devet dokumenata; git diff --check prolazi.
- Ovaj krug nije mijenjao aplikacijski izvor. Ponovljena su tri ciljana automatizirana testa i native QA6/QA7 buildovi. Prethodni relevantni puni dokaz ostaje 73 mobilna testa, TypeScript, oba izvoza, API build/liveness, backup guard i 35 HTTP/PostgreSQL scenarija; nije ponovno izvođen cijeli skup za ovaj device-only krug. Četiri high dependency nalaza nisu riješena.

## Dokazi i nastavak

Privatni logovi/screenshotovi/fixturei su u ignored local-data/native-qa-tls: android-final-*.json/png/txt/log, qa6-build.log, qa7-build.log i android-final.cjs. Lozinke/tokeni nisu uneseni u dokumentaciju. TalkBack je vraćen na početno isključeno stanje, privremene dozvole vraćene, a današnje picker datoteke uklonjene. Razvojni stack i privatni HTTPS QA API ostaju dostupni; nisu trajni hosting.

Prethodno: [EXIF i oporavak reda](ANDROID_MEDIA_RECOVERY_2026-10-29.md), [ranija Android matrica](ANDROID_DEVICE_QA_2026-10-28.md).

Slijede dependency nalazi i priprema account recovery/HTTPS privatne distribucije prema odlukama korisnika. iPhone/dva fizička uređaja odgođeni su na korisnikov zahtjev, nisu označeni PASS niti automatski uklonjeni iz beta prihvata. Stvarno probno putovanje, fizički puni disk i širi audit pristupačnosti ostaju granice ovog QA kruga. Nema commita/pusha ni odabira plaćenog dobavljača.
