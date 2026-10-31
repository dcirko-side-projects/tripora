const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { create, act } = require("react-test-renderer");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { loader } = require("./uiHarness.cjs");
global.IS_REACT_ACT_ENVIRONMENT = true;
for (const platform of ["android", "ios"])
  test(`native ${platform} picker: calendar-only date, cancellation, time and optional clearing`, async () => {
    const native = Object.fromEntries(
      [
        "View",
        "Text",
        "TextInput",
        "Pressable",
        "Modal",
        "ScrollView",
        "KeyboardAvoidingView",
        "ActivityIndicator",
      ].map((k) => [k, k]),
    );
    native.Platform = { OS: platform };
    native.StyleSheet = { create: (s) => s };
    const load = loader({
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
    });
    const { DateField } = load(join(__dirname, "../src/ui/DateField.tsx"));
    const values = [];
    let renderer;
    async function run(action) {
      await act(async () => {
        action();
      });
    }
    const press = async (label) =>
      run(() =>
        renderer.root
          .findAllByType("Pressable")
          .find((n) => n.props.accessibilityLabel === label)
          .props.onPress(),
      );
    try {
      await run(() => {
        renderer = create(
          React.createElement(DateField, {
            label: "Datum",
            value: "2026-10-25",
            minimum: "2026-10-01",
            maximum: "2026-11-01",
            optional: true,
            onChange: (v) => values.push(v),
          }),
        );
      });
      assert.equal(renderer.root.findAllByType("TextInput").length, 0);
      await press("Datum");
      let picker = renderer.root.findByType("DateTimePicker");
      assert.equal(picker.props.value.getHours(), 12);
      assert.equal(picker.props.minimumDate.getMonth(), 9);
      assert.equal(picker.props.maximumDate.getMonth(), 10);
      const chosen = new Date(2026, 9, 26, 0, 1);
      await run(() => picker.props.onChange({ type: "set" }, chosen));
      if (platform === "ios") {
        assert.equal(values.length, 0);
        await press("Odustani od odabira");
        assert.equal(values.length, 0);
        await press("Datum");
        await run(() =>
          renderer.root
            .findByType("DateTimePicker")
            .props.onChange({ type: "set" }, chosen),
        );
        await press("Potvrdi odabir");
      }
      assert.deepEqual(values, ["2026-10-26"]);
      await press("Datum");
      if (platform === "android")
        await run(() =>
          renderer.root
            .findByType("DateTimePicker")
            .props.onChange({ type: "dismissed" }, undefined),
        );
      else await press("Odustani od odabira");
      assert.equal(values.length, 1);
      await press("Ukloni datum");
      assert.equal(values.at(-1), "");
      await run(() =>
        renderer.update(
          React.createElement(DateField, {
            label: "Vrijeme",
            mode: "time",
            value: "09:30",
            optional: true,
            onChange: (v) => values.push(v),
          }),
        ),
      );
      await press("Vrijeme");
      picker = renderer.root.findByType("DateTimePicker");
      assert.equal(picker.props.is24Hour, true);
      assert.equal(picker.props.value.getHours(), 9);
      assert.equal(picker.props.value.getMinutes(), 30);
      await run(() =>
        picker.props.onChange({ type: "set" }, new Date(2026, 9, 25, 17, 45)),
      );
      if (platform === "ios") await press("Potvrdi odabir");
      assert.equal(values.at(-1), "17:45");
    } finally {
      if (renderer) await run(() => renderer.unmount());
    }
  });
test("calendar serialization remains stable across DST and UTC offsets", () => {
  for (const TZ of [
    "Europe/Zagreb",
    "America/Los_Angeles",
    "Pacific/Kiritimati",
  ]) {
    const script = `const {loader}=require('./tests/uiHarness.cjs');const d=loader()('./src/ui/dates.ts');const a=require('node:assert/strict');for(const v of ['2026-03-29','2026-10-25','0001-01-01'])a.equal(d.dateValue(d.calendarDate(v)),v);a.deepEqual(d.tripDays('2026-10-24','2026-10-27'),['2026-10-24','2026-10-25','2026-10-26','2026-10-27']);a.equal(d.displayDate('2026-10-23'),'23. 10. 2026.');`;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: join(__dirname, ".."),
      env: { ...process.env, TZ },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  }
});
for (const platform of ["android", "ios"])
  test(`native ${platform} modal: back preserves keyboard drafts and respects an active operation`, async () => {
    const native = Object.fromEntries(
      [
        "View",
        "Text",
        "TextInput",
        "Pressable",
        "Modal",
        "ScrollView",
        "KeyboardAvoidingView",
        "ActivityIndicator",
      ].map((k) => [k, k]),
    );
    native.Platform = { OS: platform };
    native.StyleSheet = { create: (s) => s };
    let keyboardVisible = false, keyboardDismissals = 0;
    native.Keyboard = {
      isVisible: () => keyboardVisible,
      dismiss: () => { keyboardVisible = false; keyboardDismissals++; },
    };
    const load = loader({
      "react-native": native,
      "react-native-svg": {
        __esModule: true,
        default: "Svg",
        Path: "Path",
        Circle: "Circle",
        Rect: "Rect",
      },
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    });
    const { FormSheet } = load(join(__dirname, "../src/ui/components.tsx"));
    let closes = 0,
      renderer;
    try {
      await act(async () => {
        renderer = create(
          React.createElement(
            FormSheet,
            {
              title: "QA modal",
              visible: true,
              busy: true,
              onClose: () => closes++,
            },
            React.createElement("Text", null, "QA draft"),
          ),
        );
      });
      assert.equal(renderer.root.findByType("Pressable").props.disabled, true);
      await act(async () =>
        renderer.root.findByType("Modal").props.onRequestClose(),
      );
      assert.equal(closes, 0);
      await act(async () =>
        renderer.update(
          React.createElement(
            FormSheet,
            {
              title: "QA modal",
              visible: true,
              busy: false,
              onClose: () => closes++,
            },
            React.createElement("Text", null, "QA draft"),
          ),
        ),
      );
      if (platform === "android") {
        keyboardVisible = true;
        await act(async () =>
          renderer.root.findByType("Modal").props.onRequestClose(),
        );
        assert.equal(keyboardDismissals, 1);
        assert.equal(closes, 0, "dismissing the keyboard must preserve the form draft");
        assert.match(JSON.stringify(renderer.toJSON()), /QA draft/);
      }
      await act(async () =>
        renderer.root.findByType("Modal").props.onRequestClose(),
      );
      assert.equal(closes, 1);
      assert.match(JSON.stringify(renderer.toJSON()), /QA draft/);
    } finally {
      if (renderer) await act(async () => renderer.unmount());
    }
  });
