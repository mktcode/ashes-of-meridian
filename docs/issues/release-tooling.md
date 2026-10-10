# Release-Werkzeuge und Assetpflege

Befunde aus dem Hygieneaudit auf `8a69e7f`; statischer Abgleich, keine Capture-/Docker-/Browserausführung. Keine automatische Implementierungs-, Aufnahme- oder Assetänderungsfreigabe. [Auslieferungsvertrag](../deployment.md) und `file://` erhalten.

## Capture-Ausgabe und Abnahme

- [ ] Wiederverwendbare Szenen-/Capture-Bausteine aus `.tmp/devlog-2026-10-08/capture.mjs` prüfen, nicht datierte Motive und Texte als neues Standardwerkzeug übernehmen. Scratch-Skripte sind lokale Hinweise, keine dauerhaften Abhängigkeiten. Gemeinsamer Browserrahmen unter [Testpflege](teststrategie-review.md#wiederverwendbare-browser--und-diagnosewerkzeuge).

## Laufzeitassets und Produktionswerkzeuge

- [ ] Falls die itch-Seitenbeschreibung dauerhaft im Repository gepflegt werden soll, einen maßgeblichen Text samt manuellem Veröffentlichungsweg festlegen. Die früher dokumentierte `release/itch-description.md` existiert nicht; keinen vermeintlich aktuellen Veröffentlichungstext erfinden.

Abnahme nach gezielter Korrektur: passende Paket-/Assetprüfung beziehungsweise genau eine betroffene Capture-Szene nach Freigabe; arrangierte Medien sind weder Balancing- noch vollständiger Spielnachweis.
