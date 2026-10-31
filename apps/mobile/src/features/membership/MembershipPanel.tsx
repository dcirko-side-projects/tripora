import { useEffect, useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { ApiClient } from "../../core/sync";
import { Button, Empty, Field, FormSheet } from "../../ui/components";
import { ui } from "../../ui/theme";
import { displayDate } from "../../ui/dates";

type Roster = {
  members: { id: string; email: string }[];
  invitations: { id: string; email: string; expiresAt: string }[];
};
type Props = {
  tripId: string;
  api: ApiClient;
  busy: boolean;
  error?: string;
  perform: (action: () => Promise<void>) => Promise<boolean>;
};
export function MembershipPanel({ tripId, api, busy, error, perform }: Props) {
  const [requested, setRequested] = useState(false);
  const [email, setEmail] = useState("");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [form, setForm] = useState(false);
  const [issued, setIssued] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [shareError, setShareError] = useState("");
  async function shareCode() {
    if (!issued) return;
    setShareError("");
    try {
      await Share.share({ message: issued.token });
    } catch {
      setShareError(
        "Dijeljenje nije otvoreno. Kod možeš kopirati dugim pritiskom i poslati suputniku.",
      );
    }
  }
  async function load() {
    setRoster(await api.request<Roster>(`/api/trips/${tripId}/members`));
  }
  useEffect(() => {
    if (!busy && !requested) {
      setRequested(true);
      void perform(load);
    }
  }, [busy, requested]);
  function invite() {
    void perform(async () => {
      if (!email.trim()) throw Error("Unesi e-mail registriranog suputnika.");
      setIssued(null);
      setNotice("");
      const result = await api.request<{ token: string; expiresAt: string }>(
        `/api/trips/${tripId}/invitations`,
        { email: email.trim() },
      );
      setIssued(result);
      setEmail("");
      await load();
    });
  }
  function confirm(path: string, label: string) {
    Alert.alert(
      label,
      "Radnja zahtijeva internet. Već preuzeti podaci mogu ostati dostupni na uređaju bez mreže.",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Potvrdi",
          style: "destructive",
          onPress: () =>
            void perform(async () => {
              await api.request(path, {});
              setIssued(null);
              setNotice("Promjena je potvrđena na serveru.");
              await load();
            }),
        },
      ],
    );
  }
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>PUTUJTE ZAJEDNO</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Sudionici
        </Text>
        <Text style={ui.muted}>Pozovi suputnika koji već ima račun.</Text>
      </View>
      <Button
        title="Pozovi suputnika"
        icon="plus"
        disabled={busy}
        onPress={() => {
          setForm(true);
          setIssued(null);
          setShareError("");
        }}
      />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={ui.muted}>
          {notice}
        </Text>
      ) : null}
      {!roster ? (
        <Empty
          icon="people"
          title="Učitaj sudionike"
          detail="Za aktualan popis i pozivnice potreban je internet."
        />
      ) : (
        <>
          <Text style={ui.subheading}>Članovi · {roster.members.length}</Text>
          {roster.members.map((m) => (
            <View key={m.id} style={ui.item}>
              <Text style={ui.body}>{m.email}</Text>
              <Button
                title={`Ukloni ${m.email}`}
                variant="danger"
                disabled={busy}
                onPress={() =>
                  confirm(
                    `/api/trips/${tripId}/members/${encodeURIComponent(m.id)}/remove`,
                    "Ukloniti člana?",
                  )
                }
              />
            </View>
          ))}
          {roster.invitations.length ? (
            <Text style={ui.subheading}>Aktivne pozivnice</Text>
          ) : null}
          {roster.invitations.map((i) => (
            <View key={i.id} style={ui.item}>
              <Text style={ui.body}>{i.email}</Text>
              <Text style={ui.caption}>
                Vrijedi do {displayDate(i.expiresAt.slice(0, 10))}
              </Text>
              <Button
                title={`Opozovi poziv za ${i.email}`}
                variant="danger"
                disabled={busy}
                onPress={() =>
                  confirm(
                    `/api/trips/${tripId}/invitations/${i.id}/revoke`,
                    "Opozvati pozivnicu?",
                  )
                }
              />
            </View>
          ))}
        </>
      )}
      <Button
        title="Osvježi sudionike"
        icon="sync"
        variant="ghost"
        disabled={busy}
        onPress={() => void perform(load)}
      />
      <FormSheet
        title="Pozovi suputnika"
        visible={form}
        onClose={() => {
          setForm(false);
          setIssued(null);
          setEmail("");
        }}
        busy={busy}
        error={shareError || error}
      >
        {issued ? (
          <>
            <Text style={ui.heading}>Pozivnica je spremna</Text>
            <Text style={ui.body}>
              Kod vrijedi do {displayDate(issued.expiresAt.slice(0, 10))}.
              Kopiraj ga ili podijeli s pozvanom osobom; prikazan je samo ovdje.
            </Text>
            <Text
              selectable
              accessibilityLabel="Kod izdane pozivnice"
              style={ui.inset}
            >
              {issued.token}
            </Text>
            <Button
              title="Podijeli kod"
              disabled={busy}
              onPress={() => void shareCode()}
            />
            <Button
              title="Gotovo"
              variant="ghost"
              onPress={() => {
                setForm(false);
                setIssued(null);
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="E-mail suputnika"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Text style={ui.muted}>
              Pozivnica je vezana uz ovaj račun. Nakon prihvaćanja suputnik može
              preuzeti putovanje.
            </Text>
            <Button title="Izdaj pozivnicu" disabled={busy} onPress={invite} />
          </>
        )}
      </FormSheet>
    </View>
  );
}
