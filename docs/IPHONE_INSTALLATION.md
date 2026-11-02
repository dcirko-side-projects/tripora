# Instalacija Tripore na iPhone

Provjereno 2026-11-02. Trenutačno nema Tripora App Store/TestFlight poveznice, potpisanog iOS paketa ni pripremljene iOS distribucije. Aktivni Render URL je API, ne stranica za instalaciju. Android APK ne može se instalirati na iPhone. Današnje UI promjene još nisu u novom instalacijskom paketu.

Za jednostavnu instalaciju preko poveznice možemo pripremiti **TestFlight**. Razvojni račun treba Apple Developer Program (99 USD godišnje, lokalna cijena gdje je dostupna), potpisani iOS build i App Store Connect distribuciju. Za vanjskog testera slijedi Appleov beta pregled kad je potreban, zatim pozivnica ili javna poveznica. Cura tada instalira besplatni TestFlight iz App Storea, otvori Tripora pozivnicu i odabere Install. Njezin plaćeni razvojni račun nije potreban. To još nije napravljeno i nije odobreno plaćanje.

Besplatna razvojna alternativa koristi Mac, Xcode i Apple Account za lokalnu instalaciju na spojeni iPhone. Personal Team ima ograničenja i sedmodnevno potpisivanje, pa traži redovitu ponovnu izradu/instalaciju. To nije trajna distribucija preko poveznice. Na ovom Windows računalu Xcode nije dostupan.

Expo Go nije puna zamjena za ovu aplikaciju: MapLibre traži vlastiti native build. Stari razvojni Expo link nije samostalna instalacija i zahtijeva pokrenuti razvojni poslužitelj.

Izvori: [Apple članstvo i cijena](https://developer.apple.com/help/account/membership/program-enrollment), [TestFlight instalacija](https://developer.apple.com/testflight/), [vanjski testeri](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers), [Personal Team ograničenja](https://developer.apple.com/help/account/basics/about-your-developer-account), [Expo lokalni development build](https://docs.expo.dev/develop/development-builds/introduction/), [MapLibre Expo setup](https://github.com/maplibre/maplibre-react-native/blob/main/docs/content/setup/expo.md).
