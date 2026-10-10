# Release-Werkzeuge und Assetpflege

Befunde aus dem Hygieneaudit auf `8a69e7f`; statischer Abgleich, keine Capture-/Docker-/Browserausführung. Keine automatische Implementierungs-, Aufnahme- oder Assetänderungsfreigabe. [Auslieferungsvertrag](../deployment.md) und `file://` erhalten.

## Capture-Ausgabe und Abnahme

- [ ] Den [Capture-Pfad](../../scripts/capture-itch-media.mjs) nach ausdrücklicher Freigabe mit einer einzelnen Desktop-Szene (`--scene 02-desert-outpost`) im Browser abnehmen, einschließlich tatsächlicher WebP-Ausgabe mit Qualität 80. Der gezielte Node-Test prüft die serialisierte [Capture-Fixture](../../scripts/capture-battle-fixture.mjs) auf den drei verwendeten Kartenrezepten: Worker-Start bleibt unverändert, beide HQs entstehen auf zulässigen Standorten, Belegung/Indizierung und expliziter Abbruch ohne Standort sind abgesichert. Renderer, UI-Lebenszyklus und tatsächliche Medienausgabe sind damit nicht geprüft.
- [ ] Wiederverwendbare Szenen-/Capture-Bausteine aus `.tmp/devlog-2026-10-08/capture.mjs` prüfen, nicht datierte Motive und Texte als neues Standardwerkzeug übernehmen. Scratch-Skripte sind lokale Hinweise, keine dauerhaften Abhängigkeiten. Gemeinsamer Browserrahmen unter [Testpflege](teststrategie-review.md#wiederverwendbare-browser--und-diagnosewerkzeuge).

## Laufzeitassets und Produktionswerkzeuge

- [ ] Falls die itch-Seitenbeschreibung dauerhaft im Repository gepflegt werden soll, einen maßgeblichen Text samt manuellem Veröffentlichungsweg festlegen. Die früher dokumentierte `release/itch-description.md` existiert nicht; keinen vermeintlich aktuellen Veröffentlichungstext erfinden.

Abnahme nach gezielter Korrektur: passende Paket-/Assetprüfung beziehungsweise genau eine betroffene Capture-Szene nach Freigabe; arrangierte Medien sind weder Balancing- noch vollständiger Spielnachweis.
