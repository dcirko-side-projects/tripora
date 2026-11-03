# Instalacija Tripore na iPhone

## Odabrani put — PWA, 2026-11-03

Korisnik je odabrao besplatnu Safari Home Screen aplikaciju. Apple Developer račun,
TestFlight i App Store nisu potrebni. Android ostaje postojeća native aplikacija.
[Plan do dovršetka i aktualni dokazi](IPHONE_PWA_PLAN.md), [STATUS](STATUS.md).
PWA beta je objavljena na postojećem Render Free servisu iz `93ac4c3`.
Automatizirane i javne browser provjere prolaze; pravi iPhone prihvat tek slijedi.

Instalacija bete:

1. U **Safariju** otvori [Triporu](https://tripora-l4c7.onrender.com/).
2. Odaberi **Dijeli → Dodaj na početni zaslon → Dodaj** (po potrebi uključi
   otvaranje kao web aplikacije).
3. Otvori novu ikonu Tripore i prijavi se svojim postojećim računom. Prva prijava
   i preuzimanje podataka trebaju internet; nakon instalacije može biti potrebna
   nova prijava iako je prethodno napravljena u Safari kartici.
4. Pričekaj završetak pripreme offline otvaranja (status u instalacijskim uputama),
   otvori putovanje i odaberi **Pripremi za offline**. Fotografije drugih članova
   preuzimaju se zasebno u uspomenama. Karta traži internet.
5. Redovito sinkroniziraj. Nemoj koristiti privatni prozor ili brisati podatke
   stranice dok postoje neposlane promjene. Browser/sustav može ukloniti lokalne
   podatke pri manjku prostora; PWA pohrana nije backup.

Završni prihvat na pravom iPhoneu: instalacija/standalone prikaz i tipkovnica,
odabir/odustajanje/JPEG/HEIC, offline spremanje → airplane mode → zatvaranje →
ponovno otvaranje → slanje nakon povratka mreže, nadogradnja s redom i zajedničko
putovanje s Androidom. Do tog prihvata ovo je priprema bete, ne potvrđeno iPhone izdanje.

## Ranije razmatrane native mogućnosti (povijest)

Provjereno 2026-11-02. Trenutačno nema Tripora App Store/TestFlight poveznice, potpisanog iOS paketa ni pripremljene iOS distribucije. Aktivni Render URL je API, ne stranica za instalaciju. Android APK ne može se instalirati na iPhone. Današnje UI promjene još nisu u novom instalacijskom paketu.

Za jednostavnu instalaciju preko poveznice možemo pripremiti **TestFlight**. Razvojni račun treba Apple Developer Program (99 USD godišnje, lokalna cijena gdje je dostupna), potpisani iOS build i App Store Connect distribuciju. Za vanjskog testera slijedi Appleov beta pregled kad je potreban, zatim pozivnica ili javna poveznica. Cura tada instalira besplatni TestFlight iz App Storea, otvori Tripora pozivnicu i odabere Install. Njezin plaćeni razvojni račun nije potreban. To još nije napravljeno i nije odobreno plaćanje.

Besplatna razvojna alternativa koristi Mac, Xcode i Apple Account za lokalnu instalaciju na spojeni iPhone. Personal Team ima ograničenja i sedmodnevno potpisivanje, pa traži redovitu ponovnu izradu/instalaciju. To nije trajna distribucija preko poveznice. Na ovom Windows računalu Xcode nije dostupan.

Expo Go nije puna zamjena za ovu aplikaciju: MapLibre traži vlastiti native build. Stari razvojni Expo link nije samostalna instalacija i zahtijeva pokrenuti razvojni poslužitelj.

Izvori: [Apple članstvo i cijena](https://developer.apple.com/help/account/membership/program-enrollment), [TestFlight instalacija](https://developer.apple.com/testflight/), [vanjski testeri](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers), [Personal Team ograničenja](https://developer.apple.com/help/account/basics/about-your-developer-account), [Expo lokalni development build](https://docs.expo.dev/develop/development-builds/introduction/), [MapLibre Expo setup](https://github.com/maplibre/maplibre-react-native/blob/main/docs/content/setup/expo.md).
