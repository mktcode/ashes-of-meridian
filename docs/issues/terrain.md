# Mothership: visuelle Abnahme des Flugdecks

Das eigenständige Flugdeck ersetzt Bergkulisse und Felsblocker. Offen ist die menschliche Abnahme: industrielle Silhouette, Übergang zu Außenhangars/Transportern und Brücke, Boden-/Einheitenkontrast, Erkennbarkeit der geschlossenen Tore und Verdeckung an Hangardächern. Leitbild bleibt ein bespielbarer Ausschnitt eines viel größeren Schiffs, keine quadratische Metallarena.

Änderungen auf Mothership begrenzen; [Desert](desert-map.md) und die freigegebene Alien-Gestaltung nicht mitverändern. Rezept und CPU-Umrisse: `src/battlefields/mothership.ts`; wiederverwendbare Architektur: `src/renderer/mothership-terrain.ts`. Gemeinsame Materialtexturen nach [Assetpflege](../rendering.md#texturen-und-portraits) behandeln.

Auf `experiment/hoehenstufen` steht ein [Höhenprototyp mit erhöhten Basisdecks und tieferem zentralem Schlachtfeld](hoehenstufen/03-karten-und-abnahme.md#mothership-erster-spielbarer-versuch) mit erstem positivem Nutzerfeedback bereit. Als nächstes folgt nur die [Sichtkorrektur](hoehenstufen/04-hoehenabhaengige-sicht.md). Rampen, Deckhöhen, versetzte Architektur/Vorkommen und Verdeckung benötigen weiterhin eine gezielte Abnahme. `main` enthält weiterhin den flachen Deckstand; keine frühere Abnahme wird übertragen.

Echte Geräte und menschliche vollständige Partien bleiben unter [Playtest-Validierung](playtest-validation.md) offen; automatisierte Prüfungen ersetzen diese Abnahme nicht.
