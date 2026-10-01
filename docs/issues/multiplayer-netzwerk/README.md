# Multiplayer: nächste Freigaben

Zwei-Menschen-Prototyp integriert; [Serverbetrieb/Protokoll](../../../server/README.md), [Systemgrenzen](../../architecture.md#netzwerkprototyp). Kartenfreigaben aus dem Katalog, keine parallel gepflegte Anzahl. Keine Expeditionen, KI, Belohnungen oder Prozess-Restore.

- [ ] Zwei echte Geräte: Bedienung/Latenz, Bewegungsglättung, Kampfeffekte/Audio und Netzunterbrechungen abnehmen; [Robustheitsbefund](robustheit.md).
- [ ] Öffentlichen Betrieb absichern: Content-Hash-Handshake, Metadaten-/ID-Seitenkanäle und Missbrauchsschutz prüfen. Protokollversion allein prüft keinen identischen Content.
- [ ] Zwei volle Räume auf Ziel-VM messen; Grenze vorher nicht erhöhen.
- [ ] [Perspektive/Karten](../multiplayer-karten-und-darstellung.md) abnehmen.
- [ ] Erst danach drei/vier menschliche Parteien gesondert entscheiden, FFA beibehalten.
- [ ] Späteren Snapshot-/Replayumfang einschließlich Queue/RNG separat definieren; Parteiansicht ist kein Snapshot.

Produktregeln bleiben unter [Multiplayer-Expeditionen](../multiplayer-expeditionen.md) blockiert. Technische WebSocket-/Browserchecks sind keine Internet-, Hör- oder Echtgeräteabnahme.
