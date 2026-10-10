# Release-Werkzeuge und Assetpflege

Befunde aus dem Hygieneaudit auf `8a69e7f`; statischer Abgleich, keine Capture-/Docker-/Browserausführung. Keine automatische Implementierungs-, Aufnahme- oder Assetänderungsfreigabe. [Auslieferungsvertrag](../deployment.md) und `file://` erhalten.

## Capture an den Worker-Start anpassen

- [ ] [Das itch-Capture-Skript](../../scripts/capture-itch-media.mjs) baut arrangierte Szenen unmittelbar nach `game.start()` anhand vorhandener HQs auf. Der aktuelle Start liefert Landungsworker, keine HQs; `homes[team]` ist damit nicht vorhanden und die anschließende Koordinatenverwendung kann nicht funktionieren. Explizite Capture-Fixtures für entwickelte Basen verwenden, ohne den produktiven Start oder Regeln zu ändern.
- [ ] Ausgabeformat und Besitz klären: `capture:itch` schreibt JPEGs unter `release/itch-media/`, während die Arbeitsregeln WebP/Qualität 80 und laufbezogene temporäre Ablage vorsehen. Gewollte Releaseartefakte von Scratch trennen; generierte Ausgaben gezielt ignorieren oder bewusst versionieren. Keine pauschale Löschung vorhandener Medien.
- [ ] Wiederverwendbare Szenen-/Capture-Bausteine aus `.tmp/devlog-2026-10-08/capture.mjs` prüfen, nicht datierte Motive und Texte als neues Standardwerkzeug übernehmen. Scratch-Skripte sind lokale Hinweise, keine dauerhaften Abhängigkeiten. Gemeinsamer Browserrahmen unter [Testpflege](teststrategie-review.md#wiederverwendbare-browser--und-diagnosewerkzeuge).

## Laufzeitassets und Produktionswerkzeuge

- [ ] Mehrfach gepflegte Musiklisten in [Audio](../../src/audio.ts), [ZIP](../../scripts/build-zip.mjs), [Dockerfile](../../Dockerfile) und [Dockerfreigaben](../../.dockerignore) gegen Auslieferungsdrift absichern. Gemeinsame maßgebliche Liste oder gezielte Konsistenzprüfung wählen; ZIP und Hosting müssen dieselben freigegebenen Aufnahmen liefern. Sprachkatalogvertrag erhalten.
- [ ] [Den alten Battlefield-Musikgenerator](../../scripts/generate-battle-music.py) fachlich einordnen: Er bezeichnet `audio/music-battlefield.ogg` als gepflegtes Source-Asset, obwohl diese Datei fehlt und nicht zur Laufzeitplaylist gehört. Bewusst erhaltenes Produktionswerkzeug dokumentieren oder überholten Weg nach Freigabe entfernen; keine unbeauftragte Neugenerierung von Audio.
- [ ] Falls die itch-Seitenbeschreibung dauerhaft im Repository gepflegt werden soll, einen maßgeblichen Text samt manuellem Veröffentlichungsweg festlegen. Die früher dokumentierte `release/itch-description.md` existiert nicht; keinen vermeintlich aktuellen Veröffentlichungstext erfinden.

Abnahme nach gezielter Korrektur: passende Paket-/Assetprüfung beziehungsweise genau eine betroffene Capture-Szene nach Freigabe; arrangierte Medien sind weder Balancing- noch vollständiger Spielnachweis.
