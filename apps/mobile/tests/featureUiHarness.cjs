const React = require("react");
const { create, act } = require("react-test-renderer");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const { connect } = require("./featureHarness.cjs");
const account = require("../.test-build/core/accountStore.js");
const entries = require("../.test-build/core/entryStore.js");
const places = require("../.test-build/core/placeStore.js");
const media = require("../.test-build/core/mediaQueue.js");
const actor = { id: "qa-owner", email: "qa-owner@example.test" };
const trip = {
  id: "qa-trip",
  name: "QA synthetic trip",
  destination: "QA island",
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  createdAt: "2026-10-25",
  ownerId: actor.id,
  role: "owner",
  version: 1,
  deleted: false,
};
global.IS_REACT_ACT_ENVIRONMENT = true;
async function featureHarness(kind, options = {}) {
  const c = connect();
  account.applyPage(c.db, [trip], 1, [{ id: trip.id, role: "owner" }]);
  const control = {
    busy: false,
    readOnly: false,
    section: "plan",
    actor,
    permission: true,
    canceled: false,
    apiCalls: [],
    removed: [],
    confirm: null,
    shareFailure: false,
    linkFailure: false,
    requests: async () => ({}),
    ...options,
  };
  let renderer, update;
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "Pressable",
      "TextInput",
      "ScrollView",
      "KeyboardAvoidingView",
      "ActivityIndicator",
      "Modal",
      "Image",
    ].map((k) => [k, k]),
  );
  Object.assign(native, {
    StyleSheet: { create: (s) => s },
    Platform: { OS: "android" },
    Alert: {
      alert(title, message, buttons) {
        control.confirm = buttons.at(-1).onPress;
      },
    },
    Linking: {
      async openURL() {
        if (control.linkFailure) throw Error("Synthetic link failure");
      },
    },
    Share: {
      async share() {
        if (control.shareFailure) throw Error("Synthetic share failure");
      },
    },
  });
  const io = {
    async prepare(_uri, _w, _h, id) {
      return {
        uri: `synthetic://${id}.png`,
        thumbnailUri: `synthetic://${id}.thumb.png`,
        sha256: "a".repeat(64),
        thumbnailSha256: "b".repeat(64),
      };
    },
    async remove(uri) {
      control.removed.push(uri);
    },
    async base64() {
      return "";
    },
    async write(id, _base, thumbnail) {
      return `synthetic://${id}${thumbnail ? ".thumb" : ""}.png`;
    },
  };
  const api = {
    async request(path, body) {
      control.apiCalls.push({ path, body });
      return control.requests(path, body);
    },
  };
  const load = require("./uiHarness.cjs").loader({
    "react-native": native,
    "react-native-svg": {
      __esModule: true,
      default: "Svg",
      Path: "Path",
      Circle: "Circle",
      Rect: "Rect",
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@react-native-community/datetimepicker": {
      __esModule: true,
      default: "DateTimePicker",
    },
    "expo-crypto": { randomUUID },
    "@maplibre/maplibre-react-native": {
      Map: "NativeMap", Camera: "MapCamera", Marker: "MapMarker",
      TransformRequestManager: { addHeader() {}, removeHeader() {} },
    },
    "expo-image-picker": {
      async requestMediaLibraryPermissionsAsync() {
        return { granted: control.permission };
      },
      async launchImageLibraryAsync() {
        return {
          canceled: control.canceled,
          assets: [{ uri: "synthetic://picker", width: 12, height: 12 }],
        };
      },
    },
  });
  const Component = load(
    join(
      __dirname,
      kind === "places"
        ? "../src/features/places/PlacesPanel.tsx"
        : kind === "members"
          ? "../src/features/membership/MembershipPanel.tsx"
          : "../src/features/work/TripWorkPanel.tsx",
    ),
  )[
    kind === "places"
      ? "PlacesPanel"
      : kind === "members"
        ? "MembershipPanel"
        : "TripWorkPanel"
  ];
  function Harness() {
    const [, setVersion] = React.useState(0);
    const [error, setError] = React.useState("");
    update = () => setVersion((v) => v + 1);
    const mutate = (action) => {
      if (control.busy) return false;
      try {
        action();
        setError("");
        update();
        return true;
      } catch (e) {
        setError(e.message);
        update();
        return false;
      }
    };
    const perform = async (action) => {
      try {
        await action();
        setError("");
        update();
        return true;
      } catch (e) {
        setError(e.message);
        update();
        return false;
      }
    };
    const parent = account.accountSnapshot(c.db).trips[0];
    return React.createElement(Component, {
      db: c.db,
      trip: parent,
      tripId: trip.id,
      destination: trip.destination,
      actor: control.actor,
      section: control.section,
      readOnly: control.readOnly,
      busy: control.busy,
      error,
      snapshot:
        kind === "places"
          ? places.placeSnapshot(c.db)
          : entries.entrySnapshot(c.db),
      places: places.placeSnapshot(c.db),
      media: media.mediaSnapshot(c.db),
      io,
      api,
      mutate,
      perform,
      onPlan: (place) => {
        control.plannedPlace = place;
      },
    });
  }
  async function run(action) {
    await act(async () => {
      await action();
      await new Promise((r) => setImmediate(r));
    });
  }
  await run(() => {
    renderer = create(React.createElement(Harness));
  });
  const button = (label) =>
    renderer.root
      .findAllByType("Pressable")
      .find(
        (n) =>
          n.props.accessibilityLabel === label ||
          n.findAllByType("Text").some((t) => t.props.children === label),
      );
  return {
    db: c.db,
    control,
    io,
    api,
    get root() {
      return renderer.root;
    },
    text: () => JSON.stringify(renderer.toJSON()),
    button,
    run,
    refresh: () => run(update),
    async press(label) {
      const node = button(label);
      assert.ok(node, "Button " + label);
      assert.ok(!node.props.disabled, "Enabled " + label);
      await run(() => node.props.onPress());
    },
    async fill(label, value) {
      await run(() =>
        renderer.root
          .findByProps({ accessibilityLabel: label })
          .props.onChangeText(value),
      );
    },
    async confirm() {
      assert.equal(typeof control.confirm, "function");
      await run(control.confirm);
      control.confirm = null;
    },
    async date(label, value) {
      const node = button(label);
      await run(() => node.props.onPress());
      await run(() =>
        renderer.root
          .findByType("DateTimePicker")
          .props.onChange({ type: "set" }, new Date(value + "T12:00:00")),
      );
    },
    async close() {
      await run(() => renderer.unmount());
      c.close();
    },
  };
}
module.exports = {
  featureHarness,
  actor,
  trip,
  entries,
  places,
  media,
  account,
};
