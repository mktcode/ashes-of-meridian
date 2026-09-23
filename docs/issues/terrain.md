# Mothership: visuelle Abnahme des Flugdecks

Das eigenständige Flugdeck ersetzt Bergkulisse und Felsblocker. Offen ist die menschliche Abnahme: industrielle Silhouette, Übergang zu Außenhangars/Transportern und Brücke, Boden-/Einheitenkontrast, Erkennbarkeit der geschlossenen Tore und Verdeckung an Hangardächern. Leitbild bleibt ein bespielbarer Ausschnitt eines viel größeren Schiffs, keine quadratische Metallarena.

Änderungen auf Mothership begrenzen; [Desert](desert-map.md) und die freigegebene Alien-Gestaltung nicht mitverändern. Rezept und CPU-Umrisse: `src/battlefields/mothership.ts`; wiederverwendbare Architektur: `src/renderer/mothership-terrain.ts`. Gemeinsame Materialtexturen nach [Assetpflege](../rendering.md#texturen-und-portraits) behandeln.

Der aktuelle Stand enthält erhöhte Basisdecks, ein tieferes zentrales Schlachtfeld und [asymmetrische Höhensicht](hoehenstufen/04-hoehenabhaengige-sicht.md). Der maßgebliche [manuelle Mothership-Test](hoehenstufen/README.md#jetzt-manuell-testen) umfasst Rampen, Deckhöhen, versetzte Architektur/Vorkommen und Verdeckung; dieses Issue ergänzt nur die oben genannten Gestaltungsfragen.

Echte Geräte und menschliche vollständige Partien bleiben unter [Playtest-Validierung](playtest-validation.md) offen; automatisierte Prüfungen ersetzen diese Abnahme nicht.
