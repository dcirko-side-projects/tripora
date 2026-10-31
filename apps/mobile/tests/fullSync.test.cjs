const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { randomUUID } = require("node:crypto");
const { connect } = require("./featureHarness.cjs");
const account = require("../.test-build/core/accountStore.js");
const entries = require("../.test-build/core/entryStore.js");
const { synchronizeAccount } = require("../.test-build/core/accountSync.js");
test("full metadata preparation resumes paginated entries after reopen without claiming photo bytes", async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), "tripora-full-qa-"));
  const file = path.join(root, "account.sqlite");
  let c = connect(file);
  const actor = { id: "qa-owner", email: "qa-owner@example.test" };
  const trip = {
    id: "qa-trip",
    name: "QA full preparation",
    destination: "Synthetic island",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    ownerId: actor.id,
    createdAt: "2026-10-25",
    version: 1,
    deleted: false,
  };
  const record = (id, feature, data, version) => ({
    id,
    tripId: trip.id,
    feature,
    data,
    version,
    authorId: actor.id,
    authorEmail: actor.email,
    createdAt: "2026-10-25",
    deleted: false,
  });
  let interrupted = true;
  const calls = [];
  const api = {
    async request(url) {
      calls.push(url);
      if (url.startsWith("/api/sync/pull"))
        return {
          items: [trip],
          cursor: 1,
          hasMore: false,
          access: [{ id: trip.id, role: "owner" }],
        };
      if (url.startsWith("/api/places/pull"))
        return { items: [], cursor: 0, hasMore: false };
      if (url === "/api/entries/pull?after=0")
        return {
          items: [
            record(
              "qa-plan",
              "plan",
              {
                title: "QA walk",
                notes: "",
                date: "2026-11-02",
                time: "09:00",
                category: "activity",
                placeId: null,
                done: false,
              },
              2,
            ),
          ],
          cursor: 2,
          hasMore: true,
        };
      if (url === "/api/entries/pull?after=2") {
        if (interrupted) throw Error("Synthetic interrupted entry page");
        return {
          items: [
            record(
              "qa-memory",
              "memory",
              {
                title: "QA remote photo",
                notes: "",
                placeId: null,
                mediaId: "qa-photo",
              },
              3,
            ),
          ],
          cursor: 3,
          hasMore: false,
        };
      }
      throw Error("Unexpected " + url);
    },
  };
  try {
    await assert.rejects(
      synchronizeAccount(c.db, api, { actor }),
      /interrupted entry page/,
    );
    assert.equal(
      account.accountSnapshot(c.db).trips[0].offlinePreparedAt,
      undefined,
    );
    assert.equal(entries.entrySnapshot(c.db).cursor, 2);
    c.close();
    c = connect(file);
    interrupted = false;
    await synchronizeAccount(c.db, api, { actor });
    assert.ok(account.accountSnapshot(c.db).trips[0].offlinePreparedAt);
    assert.equal(entries.entrySnapshot(c.db).entries.length, 2);
    assert.equal(c.db.all("SELECT * FROM local_media").length, 0);
    assert.equal(
      calls.filter((v) => v === "/api/entries/pull?after=0").length,
      1,
    );
    assert.equal(entries.entrySnapshot(c.db).cursor, 3);
  } finally {
    c.close();
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith("tripora-full-qa-"));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
