const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  featureHarness,
  actor,
  trip,
  entries,
  places,
  media,
  account,
} = require("./featureUiHarness.cjs");
test("places UI: validation, cancel, full edit, visited, link failure, delete and removed access", async () => {
  const h = await featureHarness("places");
  try {
    await h.press("Dodaj mjesto");
    await h.fill("Naziv mjesta", "QA landmark");
    await h.press("Dodaj bilješku ili poveznicu");
    await h.fill("Poveznica", "javascript:alert(1)");
    await h.press("Spremi mjesto");
    assert.equal(places.placeSnapshot(h.db).places.length, 0);
    assert.match(h.text(), /HTTP ili HTTPS/);
    await h.fill("Poveznica", "https://example.test");
    await h.press("Zatvori obrazac");
    assert.equal(places.placeSnapshot(h.db).places.length, 0);
    await h.press("Dodaj mjesto");
    await h.fill("Naziv mjesta", "QA landmark");
    await h.press("Spremi mjesto");
    const id = places.placeSnapshot(h.db).places[0].id;
    await h.press("Otvori mjesto QA landmark");
    await h.press("Uredi mjesto");
    await h.fill("Naziv mjesta", "QA edited");
    await h.fill("Bilješka", "Retained local note");
    await h.fill("Poveznica", "https://example.test");
    await h.press("Spremi mjesto");
    await h.press("Otvori mjesto QA edited");
    h.control.linkFailure = true;
    await h.press("Otvori poveznicu");
    assert.match(h.text(), /Poveznica nije otvorena/);
    await h.press("Označi posjećenim");
    assert.equal(places.placeSnapshot(h.db).places[0].visited, true);
    await h.press("Obriši mjesto");
    assert.equal(places.placeSnapshot(h.db).places[0].deleted, false);
    await h.confirm();
    assert.equal(places.placeSnapshot(h.db).places[0].deleted, true);
    assert.ok(places.placeSnapshot(h.db).pending.length);
    h.control.readOnly = true;
    await h.refresh();
    assert.ok(!h.button("Dodaj mjesto"));
    assert.equal(places.placeSnapshot(h.db).places[0].id, id);
  } finally {
    await h.close();
  }
});
test("plan UI: native date, category, completion toggle, edited draft, cancel and delete", async () => {
  const h = await featureHarness("work", { section: "plan" });
  try {
    await h.press("Dodaj aktivnost");
    await h.press("Spremi aktivnost");
    assert.equal(entries.entrySnapshot(h.db).entries.length, 0);
    await h.fill("Naslov aktivnosti", "QA transport");
    await h.press("Prijevoz");
    await h.date("Datum aktivnosti", "2026-11-03");
    await h.press("Spremi aktivnost");
    assert.equal(entries.entrySnapshot(h.db).entries[0].data.category,"transport");
    await h.press("Otvori aktivnost QA transport");
    await h.press("Označi aktivnost dovršenom");
    assert.equal(entries.entrySnapshot(h.db).entries[0].data.done, true);
    await h.press("Vrati aktivnost u plan");
    await h.press("Uredi aktivnost");
    await h.fill("Naslov aktivnosti", "QA edited activity");
    await h.fill("Bilješka aktivnosti", "Local planning note");
    await h.press("Smještaj");
    await h.press("Spremi aktivnost");
    assert.equal(
      entries.entrySnapshot(h.db).entries[0].data.notes,
      "Local planning note",
    );
    await h.press("Otvori aktivnost QA edited activity");
    await h.press("Obriši aktivnost");
    await h.confirm();
    assert.equal(entries.entrySnapshot(h.db).entries[0].deleted, true);
    await h.press("Dodaj aktivnost");
    await h.fill("Naslov aktivnosti", "Discarded draft");
    await h.press("Zatvori obrazac");
    assert.equal(entries.entrySnapshot(h.db).entries.length, 1);
  } finally {
    await h.close();
  }
});
test("packing UI: submit, edit, cancel, toggle, delete and other-person privacy", async () => {
  const h = await featureHarness("work", { section: "packing" });
  try {
    await h.fill("Stvar za ponijeti", "QA jacket");
    await h.run(() =>
      h.root
        .findByProps({ accessibilityLabel: "Stvar za ponijeti" })
        .props.onSubmitEditing(),
    );
    await h.press("Uredi QA jacket");
    await h.fill("Stvar za ponijeti", "QA edited jacket");
    await h.press("Spremi stavku");
    assert.equal(
      entries.entrySnapshot(h.db).entries[0].data.title,
      "QA edited jacket",
    );
    await h.press("QA edited jacket");
    assert.equal(entries.entrySnapshot(h.db).entries[0].data.packed, true);
    await h.press("Uredi QA edited jacket");
    await h.press("Obriši packing stavku");
    await h.confirm();
    assert.equal(entries.entrySnapshot(h.db).entries[0].deleted, true);
    entries.saveEntry(
      h.db,
      trip.id,
      "packing",
      { title: "Foreign private packing", packed: false },
      { id: "qa-other", email: "qa-other@example.test" },
      randomUUID,
    );
    await h.refresh();
    assert.ok(!h.text().includes("Foreign private packing"));
  } finally {
    await h.close();
  }
});
test("expense UI: invalid money, exact edit/delete totals, custom category and author immutability", async () => {
  const h = await featureHarness("work", { section: "expense" });
  try {
    await h.press("Postavi valutu i budžet");
    await h.fill("Budžet", "100,00");
    await h.press("Spremi budžet");
    await h.press("Dodaj trošak");
    await h.fill("Naziv troška", "QA meal");
    await h.fill("Iznos · EUR", "NaN");
    await h.press("Spremi trošak");
    assert.equal(
      entries.entrySnapshot(h.db).entries.filter((e) => e.feature === "expense")
        .length,
      0,
    );
    await h.fill("Iznos · EUR", "12,34");
    await h.press("Dodaj platitelja ili bilješku");
    await h.fill("Kategorija troška", "QA custom");
    await h.fill("Platitelj", "QA payer");
    await h.date("Datum troška", "2026-11-02");
    await h.press("Spremi trošak");
    assert.equal(entries.tripTotals(h.db, trip.id).spent, "1234");
    await h.press("Otvori trošak QA meal");
    await h.press("Uredi trošak");
    await h.fill("Iznos · EUR", "0,10");
    await h.fill("Naziv troška", "QA edited meal");
    await h.press("Spremi trošak");
    assert.equal(entries.tripTotals(h.db, trip.id).spent, "10");
    assert.equal(
      entries.entrySnapshot(h.db).entries.find((e) => e.feature === "expense")
        .authorId,
      actor.id,
    );
    await h.press("Otvori trošak QA edited meal");
    await h.press("Obriši trošak");
    await h.confirm();
    assert.equal(entries.tripTotals(h.db, trip.id).spent, "0");
  } finally {
    await h.close();
  }
});
test("budget UI: currency stays disabled after deleting the last expense", async () => {
  const h = await featureHarness("work", { section: "expense" });
  try {
    entries.saveEntry(
      h.db,
      trip.id,
      "budget",
      { currency: "EUR", budgetMinor: null },
      actor,
      randomUUID,
    );
    entries.saveEntry(
      h.db,
      trip.id,
      "expense",
      {
        title: "QA deleted",
        amountMinor: "10",
        currency: "EUR",
        date: "2026-11-01",
        category: "food",
        payer: "",
        notes: "",
      },
      actor,
      randomUUID,
    );
    const expense = entries
      .entrySnapshot(h.db)
      .entries.find((e) => e.feature === "expense");
    entries.deleteEntry(h.db, expense.id, actor, randomUUID);
    await h.refresh();
    await h.press("Uredi budžet");
    assert.equal(h.button("USD").props.disabled, true);
  } finally {
    await h.close();
  }
});
test("memory UI: draft photo cancellation, replace/remove, text edit, saved-photo retention and deletion", async () => {
  const h = await featureHarness("work", { section: "memory" });
  try {
    await h.press("Dodaj uspomenu");
    await h.fill("Naslov uspomene", "QA canceled");
    await h.press("Dodaj fotografiju");
    assert.equal(media.mediaSnapshot(h.db).length, 1);
    await h.press("Zatvori obrazac");
    assert.equal(media.mediaSnapshot(h.db).length, 0);
    assert.equal(h.control.removed.length, 2);
    await h.press("Dodaj uspomenu");
    await h.fill("Naslov uspomene", "QA memory");
    await h.press("Dodaj fotografiju");
    const first = media.mediaSnapshot(h.db)[0].id;
    await h.press("Zamijeni fotografiju");
    assert.equal(media.mediaSnapshot(h.db).length, 1);
    assert.notEqual(media.mediaSnapshot(h.db)[0].id, first);
    await h.press("Spremi uspomenu");
    const savedId = media.mediaSnapshot(h.db)[0].id;
    await h.press("Otvori uspomenu QA memory");
    await h.press("Uredi uspomenu");
    await h.fill("Naslov uspomene", "Unsaved title");
    await h.press("Zatvori obrazac");
    assert.ok(media.mediaSnapshot(h.db).some((m) => m.id === savedId));
    assert.equal(
      entries.entrySnapshot(h.db).entries[0].data.title,
      "QA memory",
    );
    await h.press("Otvori uspomenu QA memory");
    await h.press("Uredi uspomenu");
    await h.fill("Tekst uspomene", "Edited QA text");
    await h.press("Ukloni fotografiju iz uspomene");
    await h.press("Spremi uspomenu");
    assert.equal(entries.entrySnapshot(h.db).entries[0].data.mediaId, null);
    assert.equal(
      entries.entrySnapshot(h.db).entries[0].data.notes,
      "Edited QA text",
    );
    assert.equal(
      media.mediaSnapshot(h.db).length,
      1,
      "original immutable request still needs the photo",
    );
    await h.press("Otvori uspomenu QA memory");
    await h.press("Obriši uspomenu");
    await h.confirm();
    assert.equal(entries.entrySnapshot(h.db).entries[0].deleted, true);
  } finally {
    await h.close();
  }
});
test("memory UI: another author cannot edit; private remote photo downloads explicitly", async () => {
  const h = await featureHarness("work", {
    section: "memory",
    actor: { id: "qa-member", email: "qa-member@example.test" },
  });
  try {
    entries.applyEntryPage(
      h.db,
      [
        {
          id: "qa-remote-memory",
          tripId: trip.id,
          feature: "memory",
          data: {
            title: "QA remote photo",
            notes: "",
            placeId: null,
            mediaId: "qa-photo",
          },
          authorId: actor.id,
          authorEmail: actor.email,
          createdAt: "2026-10-25",
          version: 2,
          deleted: false,
        },
      ],
      2,
      h.control.actor,
    );
    h.control.requests = async () => ({
      base64: "synthetic",
      sha256: "a".repeat(64),
    });
    await h.refresh();
    await h.press("Otvori uspomenu QA remote photo");
    assert.ok(!h.button("Uredi uspomenu"));
    assert.equal(media.mediaSnapshot(h.db).length, 0);
    await h.press("Preuzmi fotografiju za offline");
    assert.equal(media.mediaSnapshot(h.db)[0].state, "downloaded");
    assert.equal(
      h.control.apiCalls.filter((c) => c.path.includes("/api/media/qa-photo"))
        .length,
      2,
    );
  } finally {
    await h.close();
  }
});
test("membership UI: issue/revoke/remove confirmations and reload after an offline failure", async () => {
  let failRoster = true;
  const h = await featureHarness("members", {
    requests: async (path, body) => {
      if (path.endsWith("/members")) {
        if (failRoster) throw Error("Synthetic offline roster");
        return {
          members: [{ id: "qa-member", email: "qa-member@example.test" }],
          invitations: [],
        };
      }
      if (path.endsWith("/invitations"))
        return { token: "a".repeat(64), expiresAt: "2026-11-01" };
      return {};
    },
  });
  try {
    assert.match(h.text(), /Učitaj sudionike/);
    failRoster = false;
    await h.press("Osvježi sudionike");
    assert.match(h.text(), /qa-member@example.test/);
    await h.press("Pozovi suputnika");
    await h.press("Izdaj pozivnicu");
    assert.equal(
      h.control.apiCalls.filter((c) => c.path.endsWith("/invitations")).length,
      0,
    );
    await h.fill("E-mail suputnika", "qa-friend@example.test");
    await h.press("Izdaj pozivnicu");
    assert.match(h.text(), /aaaaaaaaaaaaaaaa/);
    await h.press("Gotovo");
    assert.ok(!h.text().includes("a".repeat(64)));
    await h.press("Ukloni qa-member@example.test");
    assert.ok(!h.control.apiCalls.some((c) => c.path.endsWith("/remove")));
    await h.confirm();
    assert.ok(h.control.apiCalls.some((c) => c.path.endsWith("/remove")));
  } finally {
    await h.close();
  }
});
test("membership UI: failed native sharing is handled without losing the issued code", async () => {
  const h = await featureHarness("members", {
    requests: async (path) =>
      path.endsWith("/members")
        ? { members: [], invitations: [] }
        : { token: "b".repeat(64), expiresAt: "2026-11-01" },
    shareFailure: true,
  });
  try {
    await h.press("Pozovi suputnika");
    await h.fill("E-mail suputnika", "qa-friend@example.test");
    await h.press("Izdaj pozivnicu");
    await h.press("Podijeli kod");
    assert.match(h.text(), /Dijeljenje nije otvoreno/);
    assert.match(h.text(), /bbbbbbbbbbbbbbbb/);
  } finally {
    await h.close();
  }
});
test("all work sections: removed access disables every write action while preserving local records", async () => {
  for (const section of ["plan", "packing", "expense", "memory"]) {
    const h = await featureHarness("work", { section });
    try {
      entries.saveEntry(
        h.db,
        trip.id,
        "packing",
        { title: "Retained QA item", packed: false },
        actor,
        randomUUID,
      );
      const before = entries.entrySnapshot(h.db);
      account.applyPage(h.db, [], 1, []);
      await h.refresh();
      for (const label of [
        "Dodaj aktivnost",
        "Dodaj na packing listu",
        "Dodaj trošak",
        "Dodaj uspomenu",
        "Postavi valutu i budžet",
      ])
        assert.ok(!h.button(label), section + ": " + label);
      assert.deepEqual(entries.entrySnapshot(h.db), before);
    } finally {
      await h.close();
    }
  }
});
