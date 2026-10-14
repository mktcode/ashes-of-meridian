# Spielstand und Evakuierungsübergang

## Offene Fehler

- [ ] **Menü nach Zielstartfehler:** `src/ui/core.ts` setzt beim Außenpostenabschluss nur
  `view='home'`, ohne das Menü aufzubauen. Scheitert der Zielstart und wird **Keep Save**
  gewählt, kann nur die Kulisse ohne sichtbares Menü bleiben. Einen vollständigen
  Startbildschirm hinterlassen; Rettung ist vor dem Startversuch gespeichert.
  Kein automatischer Run-Abbruch oder Ersatzseed.
- [ ] **Historischer Frontier-Abbruch:** Stage 2, Seed `73670270`, zwei Parteien,
  `battle:null`: `Cannot connect broad terrain shelf with a safe ramp` nach erster
  Evakuierung. Auf `18715c5` mit `new Battlefield(73670270,'frontier',2)` im nativen
  Node-Kontext reproduziert, kein Browser-/KI-Lauf. Nach Generatoränderungen nicht
  erneut geprüft; aktuelle Reproduktion offen. Verwandter [Terrainfall](terrain-generation.md#generierungsabbrüche).
- [ ] **Ursprüngliche Versionswarnung zuordnen:** Nutzer-Payload Version 11 mit 17
  geretteten Einheiten, ohne archivierte Welten, wurde damals erfolgreich geladen;
  `Incompatible expedition save` war damit nicht reproduzierbar. Gespielter Build
  blieb unbekannt. Aktuell verlangt der Code Version 13; heutige Sperre des alten
  Saves ist erwartetes Verhalten, kein Beleg seiner ursprünglichen Beschädigung.

## Menschlich abnehmen

- [ ] Tutorial während Ankunft/Kamerafahrt/Wirtschaft/Supply/Depot unterbrechen und
  fortsetzen: Ziele erhalten, Fahrten übersprungen, Kamera bedienbar.
- [ ] Aktuelle und alte Stage abwechselnd betreten, bauen, produzieren, pausieren und
  reloaden: getrennte Speicherziele, richtige Menüszene/Buttonziele, neue Dauerboni
  bei Rückkehr ins Gefecht ohne doppelte Lieferungen. Archivende und beschädigte
  einzelne Welt ausdrücklich verständlich verwerfen.
- [ ] Außenposten-Wellen/Countdown nach Pause, Menü und Reload fortsetzen, endgültig
  geschlossene Stages nur betrachten; Rettung genau einmal, blockierte Ankunft erhalten.
  Zusammen mit [Run-Abnahme](playtest-validation.md) prüfen.
- [ ] `file://`, Hosting und Mobilgerät: Hintergrund/Prozessende/Grafikverlust sowie
  verständliche Speicherwarnung und Einstellungsstatus. Harter Abbruch darf zum
  letzten Autosave zurückführen; keine Verlustfreiheit beim Schließen zugesagt.

Gefechtsrestore wurde menschlich positiv rückgemeldet; Weltbesuche und vollständige
Geräte-/Langruns sind nicht allgemein abgenommen. Sichere Tickgrenze, gemeinsamer Write,
Versionssperren und dauerhaft flüchtiger Storage bleiben [Systemgrenzen](../architecture.md).
Speicherzeit/-quota zentral unter [Performance](performance-und-mobilstabilitaet.md);
Autosaves beheben keine Grafikabbrüche.
