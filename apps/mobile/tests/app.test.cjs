const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { create, act } = require("react-test-renderer");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const store = require("../.test-build/core/accountStore.js");
const placeStore = require("../.test-build/core/placeStore.js");
const entryStore = require("../.test-build/core/entryStore.js");
const mediaQueue = require("../.test-build/core/mediaQueue.js");
const { ApiError } = require("../.test-build/core/sync.js");
global.IS_REACT_ACT_ENVIRONMENT = true;

test("App UI: auth, trips, category views, offline place edits, invitations and access enforcement", async () => {
  const databases = new Map();
  let selected = null;
  let confirm;
  let online = false;
  let expired = false;
  let backHandler;
  let photosAllowed = true;
  let pickerCanceled = false;
  const onlineCalls = [];
  const authCalls = [];
  let loginFailure = false;
  let roster = {
    members: [{ id: "member-id", email: "member@example.test" }],
    invitations: [],
  };
  const session = {
    async restore() {
      return selected;
    },
    async signIn(email, password, register) {
      authCalls.push({email,register});
      if (loginFailure) throw new Error("Synthetic rejected login");
      selected = { id: email, email, scope: email, server: "synthetic" };
      return selected;
    },
    async signOut() {
      selected = null;
    },
    async request(path, body) {
      onlineCalls.push({ path, body });
      if (path.endsWith("/members")) return roster;
      if (path.endsWith("/invitations")) {
        roster = {
          ...roster,
          invitations: [
            { id: "invite-id", email: body.email, expiresAt: "2026-10-29" },
          ],
        };
        return { token: "a".repeat(64), expiresAt: "2026-10-29" };
      }
      if (path.endsWith("/revoke")) roster = { ...roster, invitations: [] };
      if (path.endsWith("/remove")) roster = { ...roster, members: [] };
      return {};
    },
  };
  const openAccountDatabase = (scope) => {
    if (!databases.has(scope)) {
      const sqlite = new DatabaseSync(":memory:");
      const db = {
        exec: (sql) => sqlite.exec(sql),
        run: (sql, args) => sqlite.prepare(sql).run(...args),
        all: (sql, args = []) => sqlite.prepare(sql).all(...args),
        transaction: (action) => {
          sqlite.exec("BEGIN");
          try {
            action();
            sqlite.exec("COMMIT");
          } catch (e) {
            sqlite.exec("ROLLBACK");
            throw e;
          }
        },
      };
      store.initAccountStore(db);
      databases.set(scope, { sqlite, db });
    }
    return { db: databases.get(scope).db, close() {} };
  };
  const native = Object.fromEntries(
    [
      "Modal",
      "ActivityIndicator",
      "Image",
      "KeyboardAvoidingView",
      "Pressable",
      "ScrollView",
      "Text",
      "TextInput",
      "View",
    ].map((name) => [name, name]),
  );
  Object.assign(native, {
    Share: { async share() {} },
    BackHandler: {
      addEventListener(_event, handler) {
        backHandler = handler;
        return { remove() {} };
      },
    },
    Alert: {
      alert(title, message, buttons) {
        confirm = buttons.at(-1).onPress;
      },
    },
    AppState: {
      currentState: "background",
      addEventListener() {
        return { remove() {} };
      },
    },
    Platform: { OS: "android" },
    StyleSheet: { create: (value) => value },
    Linking: { async openURL() {} },
  });
  const sync = {
    ApiError,
    async synchronize(db) {
      if (expired) throw new ApiError(401);
      if (!online) throw new Error("Synthetic offline");
      for (const p of store.accountSnapshot(db).pending) {
        if (!p.conflict)
          store.acknowledge(db, p.operation.operationId, {
            ...p.operation.data,
            id: p.operation.tripId,
            createdAt: "2026-10-21",
            version: 1,
            deleted: p.operation.kind === "trip.delete",
          });
      }
      return { conflicts: 0, errors: 0 };
    },
  };
  const mocks = {
    "react-native": native,
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Circle: "Circle",
      Rect: "Rect",
    },
    "@react-native-community/datetimepicker": {
      __esModule: true,
      default: "DateTimePicker",
    },
    "react-native-safe-area-context": {
      SafeAreaProvider: "SafeAreaProvider",
      SafeAreaView: "SafeAreaView",
    },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-crypto": { randomUUID },
    "./src/core/accountDatabase": { openAccountDatabase },
    "./src/core/accountStore": store,
    "./src/core/session": { sessionClient: session },
    "./src/core/sync": sync,
    "./src/core/accountSync": { synchronizeAccount: sync.synchronize },
    "./src/core/placeStore": placeStore,
    "../../core/placeStore": placeStore,
    "./src/core/entryStore": entryStore,
    "../../core/entryStore": entryStore,
    "./src/core/mediaQueue": mediaQueue,
    "../../core/mediaQueue": mediaQueue,
    "./src/core/tripOverview": require("../.test-build/core/tripOverview.js"),
    "./src/core/actionError": require("../.test-build/core/actionError.js"),
    "./src/core/nativeMedia": {
      createNativeMediaIO: () => ({
        async prepare() {
          return {
            uri: "synthetic://durable/photo.png",
            thumbnailUri: "synthetic://durable/thumb.png",
            sha256: "a".repeat(64),
            thumbnailSha256: "b".repeat(64),
          };
        },
        async remove() {},
        async base64() {
          return "";
        },
        async write() {
          return "synthetic://durable/download.png";
        },
      }),
    },
    "expo-image-picker": {
      async requestMediaLibraryPermissionsAsync() {
        return { granted: photosAllowed };
      },
      async launchImageLibraryAsync() {
        return {
          canceled: pickerCanceled,
          assets: [
            { uri: "synthetic://picker/photo.png", width: 16, height: 16 },
          ],
        };
      },
    },
  };
  const load = require("./uiHarness.cjs").loader(mocks);
  const module = { exports: load(join(__dirname, "../App.tsx")) };
  let renderer;
  async function run(action) {
    await act(async () => {
      action();
      await new Promise((r) => setImmediate(r));
    });
  }
  const text = () => JSON.stringify(renderer.toJSON());
  const button = (label) =>
    renderer.root
      .findAllByType("Pressable")
      .find(
        (n) =>
          n.props.accessibilityLabel === label ||
          n.findAllByType("Text").some((t) => t.props.children === label),
      );
  async function press(label) {
    const node = button(label);
    assert.ok(node, "Button: " + label);
    assert.ok(!node.props.disabled, "Enabled: " + label);
    await run(() => node.props.onPress());
  }
  async function tab(label) {
    const node = renderer.root
      .findAllByType("Pressable")
      .find(
        (n) =>
          n.props.accessibilityRole === "tab" &&
          (n.props.accessibilityLabel === label ||
            n.findAllByType("Text").some((t) => t.props.children === label)),
      );
    assert.ok(node, "Tab: " + label);
    await run(() => node.props.onPress());
  }
  async function fill(label, value) {
    await run(() =>
      renderer.root
        .findByProps({ accessibilityLabel: label })
        .props.onChangeText(value),
    );
  }
  async function login(email) {
    await fill("E-mail", email);
    await fill("Lozinka", "Synthetic!123");
    await press("Prijavi se");
  }
  function capture(name) {
    if (!process.env.TRIPORA_UI_CAPTURE) return;
    const fs = require("node:fs");
    const path = require("node:path");
    fs.mkdirSync(process.env.TRIPORA_UI_CAPTURE, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.TRIPORA_UI_CAPTURE, name + ".json"),
      JSON.stringify(renderer.toJSON(), (key, value) =>
        typeof value === "function" && key === "style"
          ? value({ pressed: false })
          : value,
      ),
    );
  }
  async function date(label, value) {
    await press(label);
    await run(() =>
      renderer.root
        .findByType("DateTimePicker")
        .props.onChange({ type: "set" }, new Date(value + "T12:00:00")),
    );
  }
  async function time(label, hour, minute) {
    await press(label);
    const value = new Date(2026, 10, 2, hour, minute);
    await run(() =>
      renderer.root
        .findByType("DateTimePicker")
        .props.onChange({ type: "set" }, value),
    );
  }
  async function openPlace(name) {
    await press("Otvori mjesto " + name);
  }
  try {
    await run(() => {
      renderer = create(React.createElement(module.exports.default));
    });
    await fill('E-mail','a@example.test');await fill('Lozinka','Synthetic!123');loginFailure=true;await press('Prijavi se');assert.match(text(),/Synthetic rejected login/);assert.equal(selected,null);loginFailure=false;await press('Kreiraj račun');await press('Registriraj se');assert.ok(authCalls.some(c=>c.email==='a@example.test'&&c.register));
    assert.match(text(), /Moja putovanja/);
    assert.ok(!button("Spremi putovanje"));
    assert.ok(!button("Dodaj mjesto"));
    await press("Novo putovanje");
    await press("Spremi putovanje");
    capture("trips");
    assert.equal(
      store.accountSnapshot(databases.get("a@example.test").db).pending.length,
      0,
    );
    assert.ok(
      renderer.root.findAllByProps({ accessibilityRole: "alert" }).length > 0,
    );
    await fill("Naziv putovanja", "UI synthetic trip");
    await fill("Destinacija", "Test island");
    await date("Početak putovanja", "2026-11-01");
    await date("Završetak putovanja", "2026-11-03");
    await press("Spremi putovanje");
    assert.equal(
      store.accountSnapshot(databases.get("a@example.test").db).pending.length,
      1,
    );
    assert.ok(!text().includes("Naslov aktivnosti"));
    assert.ok(!button("Dodaj mjesto"));
    await press("Otvori putovanje UI synthetic trip");
    assert.match(text(), /Pregled putovanja/);
    capture("overview");
    await tab("Mjesta");
    await tab("Hrana");
    await press("Dodaj mjesto");
    await fill("Naziv mjesta", "UI synthetic cafe");
    await fill("Adresa", "Test street");
    await press("Dodaj bilješku ili poveznicu");
    await fill("Bilješka", "Keep offline note");
    await fill("Poveznica", "https://example.test/cafe");
    await press("Spremi mjesto");
    assert.ok(!text().includes("Keep offline note"));
    await openPlace("UI synthetic cafe");
    assert.match(text(), /Keep offline note/);
    await press("Označi posjećenim");
    const offlinePlaces = placeStore.placeSnapshot(
      databases.get("a@example.test").db,
    );
    assert.equal(offlinePlaces.places[0].category, "food");
    assert.equal(offlinePlaces.places[0].visited, true);
    assert.equal(offlinePlaces.pending[0].operation.data.visited, false);
    assert.ok(offlinePlaces.pending[0].followupId);
    await press("Zatvori obrazac");
    await tab("Za posjetiti");
    assert.ok(!text().includes("UI synthetic cafe"));
    await tab("Posjećeno");
    assert.match(text(), /UI synthetic cafe/);
    await tab("Izlasci");
    await press("Dodaj mjesto");
    await fill("Naziv mjesta", "UI synthetic venue");
    await press("Spremi mjesto");
    assert.equal(
      placeStore
        .placeSnapshot(databases.get("a@example.test").db)
        .places.find((p) => p.name === "UI synthetic venue").category,
      "nightlife",
    );
    await tab("Hrana");
    await openPlace("UI synthetic cafe");
    await press("Dodaj u dnevni plan");
    assert.match(text(), /Nova aktivnost/);
    await fill("Naslov aktivnosti", "UI morning walk");
    await date("Datum aktivnosti", "2026-11-02");
    await time("Vrijeme aktivnosti", 9, 30);
    await press("Spremi aktivnost");
    const db = databases.get("a@example.test").db;
    const activity = entryStore
      .entrySnapshot(db)
      .entries.find((e) => e.feature === "plan");
    assert.equal(activity.data.placeId, offlinePlaces.places[0].id);
    assert.equal(activity.data.time, "09:30");
    assert.match(text(), /UI morning walk/);
    capture("plan");
    await tab("Dan 1. 11. 2026.");
    assert.ok(!text().includes("UI morning walk"));
    await tab("Dan 2. 11. 2026.");
    assert.match(text(), /UI morning walk/);
    await press("Otvori aktivnost UI morning walk");
    await press("Uredi aktivnost");
    await press("Ukloni datum");
    await press("Spremi aktivnost");
    assert.equal(
      entryStore.entrySnapshot(db).entries.find((e) => e.feature === "plan")
        .data.date,
      "",
    );
    await tab("Više");
    await press("Moja packing lista");
    await fill("Stvar za ponijeti", "Synthetic jacket");
    await press("Dodaj na packing listu");
    const checkbox = renderer.root
      .findAllByType("Pressable")
      .find((n) => n.props.accessibilityRole === "checkbox");
    await run(() => checkbox.props.onPress());
    assert.equal(
      entryStore.entrySnapshot(db).entries.find((e) => e.feature === "packing")
        .data.packed,
      true,
    );
    capture("packing");
    await run(() => backHandler());
    assert.match(text(), /Još za putovanje/);
    await tab("Troškovi");
    await press("Postavi valutu i budžet");
    await fill("Budžet", "100,00");
    await press("Spremi budžet");
    for (const [title, amount] of [
      ["UI coffee", "0,10"],
      ["UI snack", "0,20"],
    ]) {
      await press("Dodaj trošak");
      await fill("Naziv troška", title);
      await fill("Iznos · EUR", amount);
      await press("Dodaj platitelja ili bilješku");
      await fill("Platitelj", "Synthetic payer");
      await press("Spremi trošak");
    }
    assert.equal(
      entryStore.tripTotals(db, store.accountSnapshot(db).trips[0].id).spent,
      "30",
    );
    await tab("Platitelji");
    assert.match(text(), /Synthetic payer/);
    capture("expenses");
    await tab("Više");
    await press("Uspomene");
    await press("Dodaj uspomenu");
    capture("memory-form");
    await fill("Naslov uspomene", "UI memory");
    await fill("Tekst uspomene", "Offline memory note");
    photosAllowed = false;
    await press("Dodaj fotografiju");
    assert.match(text(), /Dopusti pristup/);
    assert.equal(mediaQueue.mediaSnapshot(db).length, 0);
    photosAllowed = true;
    pickerCanceled = true;
    await press("Dodaj fotografiju");
    assert.equal(mediaQueue.mediaSnapshot(db).length, 0);
    pickerCanceled = false;
    await press("Dodaj fotografiju");
    await press("Spremi uspomenu");
    assert.equal(mediaQueue.mediaSnapshot(db).length, 1);
    capture("memories");
    assert.ok(!text().includes("Offline memory note"));
    await press("Otvori uspomenu UI memory");
    assert.match(text(), /Offline memory note/);
    await press("Zatvori obrazac");
    await tab("Pregled");
    const overview = renderer.root.findByProps({
      accessibilityLabel: "Pregled putovanja UI synthetic trip",
    });
    assert.match(
      JSON.stringify(
        overview.findAllByType("Text").map((n) => n.props.children),
      ),
      /0,30 EUR/,
    );
    await run(()=>renderer.unmount());await run(()=>{renderer=create(React.createElement(module.exports.default));});assert.match(text(),/UI synthetic trip/);await press('Otvori putovanje UI synthetic trip');await press('Uspomene');await press('Otvori uspomenu UI memory');assert.match(text(),/Offline memory note/);await press('Zatvori obrazac');await tab('Pregled');
    await press("Sva putovanja");
    await tab("Račun");
    await press("Odjava");
    await run(confirm);
    await login("b@example.test");
    assert.ok(!text().includes("UI synthetic trip"));
    assert.equal(
      placeStore.placeSnapshot(databases.get("b@example.test").db).places
        .length,
      0,
    );
    assert.equal(
      entryStore.entrySnapshot(databases.get("b@example.test").db).entries
        .length,
      0,
    );
    assert.equal(
      mediaQueue.mediaSnapshot(databases.get("b@example.test").db).length,
      0,
    );
    await tab("Račun");
    await press("Odjava");
    await run(confirm);
    await login("a@example.test");
    assert.match(text(), /UI synthetic trip/);
    expired = true;
    await tab("Sinkronizacija");
    await press("Sinkroniziraj");
    assert.match(text(), /Obnovi prijavu/);
    assert.equal(store.accountSnapshot(db).pending.length, 1);
    await press("Nastavi s lokalnim podacima");
    assert.match(text(), /Prijava je istekla/);
    await press("Obnovi prijavu");
    expired = false;
    await fill("Lozinka", "Synthetic!123");
    await press("Prijavi se");
    const pending = store.accountSnapshot(db).pending[0];
    store.applyPage(
      db,
      [
        {
          ...pending.operation.data,
          name: "Server UI trip",
          id: pending.operation.tripId,
          version: 2,
          deleted: false,
          createdAt: "2026-10-21",
        },
      ],
      2,
    );
    online = true;
    await tab("Sinkronizacija");
    await press("Sinkroniziraj");
    assert.match(text(), /Sukob promjena/);
    await press("Prihvati serversku verziju");
    await run(confirm);
    assert.equal(store.accountSnapshot(db).pending.length, 0);

    // Exercise both child conflict panels through the app, preserving the latest offline draft.
    const cafe = placeStore
      .placeSnapshot(db)
      .places.find((p) => p.name === "UI synthetic cafe");
    placeStore.applyPlacePage(
      db,
      [{ ...cafe, name: "Remote cafe revision", version: 4 }],
      4,
    );
    const planDraft = entryStore
      .entrySnapshot(db)
      .entries.find((e) => e.feature === "plan");
    entryStore.applyEntryPage(
      db,
      [
        {
          ...planDraft,
          data: { ...planDraft.data, title: "Remote plan revision" },
          version: 5,
        },
      ],
      5,
    );
    await press("Sinkroniziraj");
    assert.match(text(), /Promjena mjesta treba pažnju/);
    assert.match(text(), /Zapis treba pažnju/);
    await press("Zadrži moje mjesto");
    await run(confirm);
    assert.equal(
      placeStore.placeSnapshot(db).places.find((p) => p.id === cafe.id).notes,
      "Keep offline note",
    );
    assert.equal(
      placeStore
        .placeSnapshot(db)
        .pending.find((p) => p.operation.placeId === cafe.id).operation
        .baseVersion,
      4,
    );
    await press("Zadrži moj zapis");
    await run(confirm);
    assert.equal(
      entryStore.entrySnapshot(db).entries.find((e) => e.id === planDraft.id)
        .data.date,
      "",
    );
    assert.equal(
      entryStore
        .entrySnapshot(db)
        .pending.find((p) => p.operation.entryId === planDraft.id).operation
        .baseVersion,
      5,
    );
    placeStore.applyPlacePage(db, [{ ...cafe, deleted: true, version: 6 }], 6);
    entryStore.applyEntryPage(
      db,
      [{ ...planDraft, deleted: true, version: 7 }],
      7,
    );
    await press("Sinkroniziraj");
    assert.ok(!button("Zadrži moje mjesto"));
    assert.ok(!button("Zadrži moj zapis"));
    await press("Prihvati serversko mjesto");
    await run(confirm);
    await press("Prihvati serverski zapis");
    await run(confirm);
    assert.equal(
      placeStore.placeSnapshot(db).places.find((p) => p.id === cafe.id).deleted,
      true,
    );
    assert.equal(
      entryStore.entrySnapshot(db).entries.find((e) => e.id === planDraft.id)
        .deleted,
      true,
    );
    await tab("Putovanja");
    await press("Otvori putovanje Server UI trip");

    await tab("Više");
    await press("Postavke putovanja");
    await press("Uredi putovanje");
    await fill("Destinacija", "QA updated destination");
    await press("Spremi putovanje");
    assert.equal(
      store.accountSnapshot(db).trips[0].destination,
      "QA updated destination",
    );
    await tab("Pregled");
    await press("Sudionici");
    await press("Pozovi suputnika");
    await fill("E-mail suputnika", "invitee@example.test");
    await press("Izdaj pozivnicu");
    assert.match(text(), /aaaaaaaaaaaaaaaa/);
    await press("Gotovo");
    await press("Opozovi poziv za invitee@example.test");
    await run(confirm);
    assert.ok(onlineCalls.some((c) => c.path.endsWith("/revoke")));
    await press("Ukloni member@example.test");
    await run(confirm);
    assert.ok(
      onlineCalls.some((c) => c.path.includes("/members/member-id/remove")),
    );
    await press("Natrag");
    await tab("Više");
    await press("Postavke putovanja");
    await press("Obriši putovanje");
    await run(confirm);
    assert.equal(store.accountSnapshot(db).trips.length, 0);
    await tab("Račun");
    await press("Pridruži se putovanju");
    await fill("Kod pozivnice", "b".repeat(64));
    await press("Prihvati pozivnicu");
    assert.ok(
      onlineCalls.some(
        (c) =>
          c.path === "/api/invitations/accept" &&
          c.body.token === "b".repeat(64),
      ),
    );
    store.applyPage(
      db,
      [
        {
          name: "Shared member trip",
          destination: "Test island",
          startDate: "2026-11-01",
          endDate: "2026-11-03",
          id: "shared-ui",
          ownerId: "another-user",
          version: 3,
          deleted: false,
          createdAt: "2026-10-22",
        },
      ],
      3,
      [{ id: "shared-ui", role: "member" }],
    );
    await tab("Sinkronizacija");
    await press("Sinkroniziraj");
    await tab("Putovanja");
    await press("Otvori putovanje Shared member trip");
    await press("Sudionici");
    assert.match(text(), /Član · pregled/);
    assert.ok(!button("Pozovi suputnika"));
    await tab("Više");
    await press("Postavke putovanja");
    assert.ok(!button("Uredi putovanje"));
    assert.ok(!button("Obriši putovanje"));
    await tab("Mjesta");
    await press("Dodaj mjesto");
    await fill("Naziv mjesta", "Member place");
    await press("Spremi mjesto");
    assert.ok(
      placeStore
        .placeSnapshot(db)
        .places.some(
          (p) => p.tripId === "shared-ui" && p.name === "Member place",
        ),
    );
    store.applyPage(db, [], 3, []);
    await press("Status sinkronizacije");
    await press("Sinkroniziraj");
    await tab("Putovanja");
    await press("Otvori putovanje Shared member trip");
    assert.match(text(), /Pristup je uklonjen/);
    await tab("Mjesta");
    assert.ok(!button("Dodaj mjesto"));
  } finally {
    if (renderer) await run(() => renderer.unmount());
    for (const { sqlite } of databases.values()) sqlite.close();
  }
});
