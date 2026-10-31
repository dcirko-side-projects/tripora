# Interaktivna karta putovanja — prijedlog za raspravu

Povijesno istraživanje: korisnik je naknadno odobrio implementaciju pronalaženja po nazivu/gradu i online karte, bez kartice i uz offline popis. Aktualni opseg: [odluka 0005](decisions/0005-maps-and-no-card-beta.md), [hosting koraci](NO_CARD_SETUP.md). Izvorne opcije ispod nisu sve implementirane.

Datum istraživanja: 2026-10-31. Status: **nije implementirano ni odabran provider**. Nisu dodani SDK, API ključ, baza, endpoint ili karta. Pretpostavka prijedloga je nastavak zahtjeva za besplatnom privatnom betom. Točan budžet i važnost Google pretrage tek treba dogovoriti.

## 1. UX unutar postojeće aplikacije

Zadržati Pregled / Plan / Mjesta / Troškovi / Više. U Mjestima ponuditi preklopnik **Popis | Karta**, uz postojeće kategorije Mjesta / Hrana / Izlasci i status posjećenosti. Karta inicijalno pokazuje sva spremljena mjesta; filteri su zajednički s popisom. Pregled putovanja može imati prečac „Prikaži mjesta na karti”. Ne dodavati šestu donju karticu.

Karta zauzima raspoloživ mobilni ekran. Dodir markera otvara donju karticu s nazivom, kategorijom, vlastitom bilješkom, adresom ako je dostupna i dopuštena te akcijama „Detalji”, „Dodaj u plan” i „Otvori navigaciju”. Ponoviti postojeći detalj mjesta umjesto drugog editora. Ikona i oznaka kategorije prate boju, kako boja ne bi bila jedini signal. Filtri „Sva / Za posjetiti / Posjećena” ostaju jednostavni.

Bez koordinata mjesto ostaje vidljivo u popisu uz akciju „Odredi položaj”; ne izmišljati pin iz naziva. Bez mreže prikazati lokalni popis i spremljene korisničke podatke. Jasno navesti kada podloga karte nije dostupna. Pristupačan popis uvijek je alternativni način rada. Lokacijska dozvola nije potrebna za kartu putovanja; eventualno „Moja lokacija” kasnije traži dozvolu tek na dodir.

## 2. Tehničke opcije

| Opcija | Prednosti | Nedostaci i prikladnost |
| --- | --- | --- |
| Google Maps + Places UI Kit / dopušteni Places tok | Karta i traženje stvarnih restorana/znamenitosti; službene mobilne komponente | Billing, više SKU-ova, ograničenja pohrane i EEA prikaza; UI Kit treba spoj s React Nativeom i provjeru SDK 57. Dobar kandidat ako Google pretraga postane prioritet. |
| react-native-maps | Native prikaz Android/iOS, markeri; Expo dokumentira integraciju | Sam po sebi ne daje pretraživanje mjesta. Provider je odvojena odluka; Google zahtijeva konfiguraciju native ključeva/builda. [Expo dokumentacija](https://docs.expo.dev/versions/latest/sdk/map-view/). |
| MapLibre Native + OSM podaci preko ugovorenog tile/search providera | Native Android/iOS, sloboda stila i vlastitih pinova | Biblioteka ne uključuje hosting podloge, POI pretragu ni prava trajne pohrane rezultata. Potreban native build i provjera kompatibilnosti s ovom RN verzijom. [MapLibre](https://maplibre.org/maplibre-react-native/). |
| Leaflet + OSM podloga | Otvorena biblioteka, praktična za budući web prikaz | Leaflet radi u web dokumentu; RN bi trebao WebView i komunikacijski most, dodatnu provjeru gesti/pristupačnosti. Nije prvi izbor za postojeći native klijent. [Leaflet](https://leafletjs.com/). |
| Postojeći vanjski link / Google Maps URL | Najmanji trošak i složenost, bez Google API ključa | Nema ugrađene karte ni ugrađene pretrage. Dobar trajni fallback. [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). |

**Bitno za Hrvatsku/EEA billing račun:** nove integracije pod EEA uvjetima imaju ograničenje korištenja Places API sadržaja uz bilo koju kartu, s iznimkom latitude/longitude/place_id. To se odnosi i na vizualno povezane kartice/popise. Google navodi Places UI Kit kao alternativu. Nije dovoljno samo izabrati Google podlogu. Primjenjivost se utvrđuje prema stvarnom billing računu i ugovoru. [Službeni EEA vodič](https://developers.google.com/maps/comms/eea/places).

Places ID smije se čuvati neograničeno, ali ostali Google sadržaj nije automatski trajni offline podatak. Iznimke za prikaz nisu isto što i prava pohrane. Ne kopirati automatski Google naziv/adresu/fotografije/recenzije u trajni zajednički SQLite zapis i obećati offline dostupnost. Razdvojiti vlastiti korisnički sadržaj od licenciranih provider podataka. Prije Google MVP-a definirati dopuštena polja, rokove cachea, atribuciju i brisanje/obnovu. [Places pravila pohrane i atribucije](https://developers.google.com/maps/documentation/places/web-service/policies).

## 3. Pretraživanje → odabir → spremanje → karta

Prijedlog: u postojećem obrascu „Dodaj mjesto” ponuditi „Pretraži mjesto” i zadržati ručni unos. Korisnik upisuje naziv + grad; rezultati se traže tek nakon kratke stanke, stari odgovori odbacuju, a grad putovanja služi kao pomoć za rangiranje, ne tvrda granica. Prikazati naziv/adresu radi razlike između podružnica. Odabir prikazuje pregled; korisnik potvrđuje kategoriju i svoju bilješku pa tek tada sprema. Greška/kvota ne smije izbrisati nacrt. Ručni unos i ručno postavljanje pina ostaju dostupni bez pretrage.

Predloženi novi podaci, tek nakon odobrenja: opcionalni lat/lng, locationSource, provider i providerPlaceId te metapodaci dopuštenog cachea ako treba. U korisničkom zapisu odvojiti ručno unesene podatke od provider sadržaja. Koordinate validirati kao konačne brojeve u rasponu ±90/±180. Isto mjesto unutar putovanja može ponuditi upozorenje na duplikat, bez zabrane jer korisnik može imati različite svrhe posjeta.

Spremanje koristi postojeći atomski SQLite entity+outbox tok. Pin se dobiva lokalnim čitanjem istog zapisa i odmah je vidljiv; nema zasebne tablice pinova ni slanja „spremi pin” uz „spremi mjesto”. Migrations na klijentu/serveru moraju očuvati stare zapise i red. Postojeći sync ponavlja isti ID operacije; konflikti obuhvaćaju i položaj, a tombstone uklanja pin. Server provjerava članstvo pri pretrazi/spremanju ako pretraga ide kroz API. SDK ključeve ograničiti na paket/potpis ili iOS bundle; serverski ključ ostaje na serveru. Dodati rate limit i provider kvotu; ne slati privatne bilješke provideru.

## 4. Što se ponovno koristi

PlaceRecord već ima kategoriju place/food/nightlife, naziv, adresu, HTTP(S) link, bilješke, posjećenost, creator i verziju. Nema koordinata niti provider ID-a. Plan i uspomene već referenciraju placeId; „Dodaj u plan” može koristiti postojeći tok bez kopiranja mjesta. Postoje CRUD, filteri, detalji/form modali, AccountSnapshot/PlaceSnapshot, članstvo, konflikti, brisanja, lokalni red i priprema metapodataka za offline.

Restorani pripadaju food, izlasci nightlife, a znamenitosti/plaže/aktivnosti mogu početi u place. Za MVP nisu nužne nove obvezne kategorije. Kasnije dodati jednostavne podvrste samo ako korisnicima nedostaju. Postojeće fotografije uspomena ostaju vlastite privatne fotografije; Google fotografije nisu zamjena za taj sustav.

## 5. Besplatno, kvote i troškovi

Google cjenik na datum provjere: native Maps SDK naveden je bez ograničenja besplatne količine; web Dynamic Maps ima 10.000 besplatnih događaja mjesečno pa 7 USD/1.000 u prvom plaćenom razredu. Autocomplete Requests: 10.000 pa 2,83 USD/1.000; Place Details Essentials: 10.000 pa 5 USD/1.000; Place Details Pro: 5.000 pa 17 USD/1.000. `displayName` u Place Details može podići zahtjev na Pro; `name` je resursni identifikator, ne korisnički naziv. UI Kit ima zasebne stavke. Primjer samo za Autocomplete: 12.000 obračunatih zahtjeva znači 5,66 USD nakon besplatne količine, bez ostalih usluga. To nisu korisnici ni odabrana mjesta. Session tokeni i odabrana polja mijenjaju obračun. [Cjenik](https://developers.google.com/maps/billing-and-pricing/pricing), [Place Details polja](https://developers.google.com/maps/documentation/places/web-service/place-details).

Besplatna količina nije fiksan besplatan paket cijele integracije. Prije aktivacije treba billing, ograničenje ključeva, API kvote i budžetska upozorenja; upozorenje samo po sebi nije blokada naplate. Ne aktivirati naplatu bez dogovora.

OSM podaci i renderer mogu biti otvoreni, ali javni serveri nisu neograničeni besplatni backend. Standardni OSM tiles nemaju SLA i zabranjuju bulk/offline prefetch; potrebna je vidljiva atribucija. Javni Nominatim ima najviše 1 zahtjev/s i zabranjuje klijentski autocomplete, pa nije prikladan za traženje pri svakom znaku. [Tiles pravila](https://operations.osmfoundation.org/policies/tiles/), [Nominatim pravila](https://operations.osmfoundation.org/policies/nominatim/).

MapTiler je kandidat za usporedbu map/search usluge: Free ne traži billing podatke i pauzira servis nakon kvote umjesto automatske nadoplate. Flex naplaćuje prekoračenja. Kvota ovisi i o korištenom SDK-u/zahtjevima; prije odabira zabilježiti točne Free brojke iz aktualnog dashboarda i prava trajne pohrane rezultata. Dostupnost Free plana ne znači da je svaki željeni POI/offline tok uključen. [Cjenik i uvjeti kvota](https://www.maptiler.com/cloud/pricing/).

## 6. Preporučeni MVP i kasniji koraci

Preporuka za postojeći zahtjev 0 troška: **prvo native karta vlastitih spremljenih mjesta, ručni pin i vanjska navigacija**, uz stalno dostupan popis. Prednost je mali UX i očuvan offline ugovor. Nedostatak je izostanak automatskog pronalaska restorana. MapLibre + provider s izričito prihvatljivim Free kvotama i pravima je vodeći kandidat za taj smjer, ali nije konačan odabir. Provjera kompatibilnosti SDK-a i stvarne podloge prethodi implementaciji.

Ako je automatsko traženje stvarnih objekata obvezno već u MVP-u, prije koda napraviti mali provider spike: ista sintetička lista naziva u Budimpešti, Zagreb + jedno manje mjesto, kvaliteta rezultata, native SDK 57, EEA UI Kit i dopuštena trajna pohrana. Google Maps + Places UI Kit je tada glavni kandidat zbog traženog iskustva; veća integracija i billing su nedostaci. Ne kombinirati Google sadržaj s vlastitom offline bazom bez ugovorno dopuštenog modela.

MVP obuhvaća preklopnik popis/karta, pinove po kategoriji, fit-to-all, donju karticu, filter posjećenosti, ručno zadavanje položaja, postojeći „Dodaj u plan” i vanjsku navigaciju. Pretraga je uključena samo ako se odobri njezin provider/model. Nema offline preuzimanja cijelih karata, rezervacija, recenzija ili vlastite turn-by-turn navigacije.

Kasnije: filtar po danu iz postojećih plan veza, clustering kod puno pinova, „blizu odabranog mjesta”, predloženi redoslijed obilaska i označavanje favorita. Linija između pinova može biti samo vizualni redoslijed, ne obećana cestovna ruta ili vrijeme dolaska. Rutiranje i offline podloge traže novu procjenu kvota, licence i prostora. Live tracking nije potreban.

Prije prihvata implementacije provjeriti: stari podaci nakon migracije; offline dodavanje/uređivanje i restart; gubitak potvrde bez duplikata; konflikt položaja; brisanje i uklonjeni član; bez koordinata i bez mreže; nedostupan provider/kvota; veliki tekst i čitač zaslona; Android i iPhone native prikaz. Ovaj dokument nije dokaz da ijedan map tok već radi.
