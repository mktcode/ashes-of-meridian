# Desert: Materialabnahme und Felsverfeinerung

Gestaltungsziel bleibt die warme, trockene Wüste mit bodenfarbigen Felsen, nicht die dunkle Basaltlandschaft der KI-Referenz. Lowpoly ist keine Stilvorgabe; zusätzliche Polygone sind erlaubt, sofern die Karte auf halbwegs aktueller Mobilhardware flüssig bleibt. Keine pauschale Reduktion um ein Drittel vorgeben.

- Teilabnahme: Der Nutzer bewertet den Fels-Boden-Übergang in der Desert-Nahaufnahme mit Prospector (14.09.2026) positiv. Diese Materialabstimmung erhalten; keine pauschale Freigabe aller Geländeübergänge.
- Der isolierte Lichtpass wurde anhand der belebten Vergleichsszenen positiv bewertet. Licht und der ausdrücklich gewünschte Tilt-Shift bleiben bei der Geometrieabnahme unverändert (maßgeblich: [Grafik](../rendering.md#terrain-und-renderpässe)).
- Offen bleibt die menschliche Abnahme von Texturmaßstab, Kachelwiederholung, Dekordichte und Einheitenkontrast. Die gelieferten Boden-/Felsquellen wurden vom Nutzer in GIMP als nahtlos bestätigt; Pflege und Sampling unter [Grafik/Assets](../rendering.md).
- **Neue Felsformen abnehmen:** Desert-eigene, ineinandergreifende Bruchkörper und flache Platten ersetzen die freistehenden Standardfelsen. Vorhandenes Kleingeröll verwendet niedrige Steinmeshes mit Felsmaterial und sitzt direkt am Boden; Anzahl, X/Z-Positionen, Kollisionsradien und Layout-RNG bleiben erhalten. Große Massive, Randgebirge, Frachtquader und Ressourcensockel sind bewusst unverändert. Belebte A/B-Galerie: `/home/mkt/Bilder/Ashes-of-Meridian/desert-felsformen-2026-09-14/index.html` — insbesondere „Basis“ für die neuen Silhouetten; identische Kameras und eingefrorener Szenenzustand innerhalb der Paare.
- **Mobilbudget prüfen:** Im technischen `file://`-Vergleich (Seed 1409, 1440×1000, High) entstehen rund 68.000 zusätzliche Dreiecke je Statikdurchlauf und zwei zusätzliche Draw Calls pro Frame einschließlich Schattenwiederholung. Die sechs wiederverwendeten Meshes benötigen zusammen rund 127 KiB Vertexdaten. Fehlerfreies Desktop-/Headless-WebGL ist kein Nachweis flüssiger Mobilhardware; echte Geräte und thermische Dauerlast bleiben offen.
- Zusätzliche nichtblockierende Steinplatten/Splitter erst nach Sichtung dieser Formen entscheiden, noch keine höhere Dekordichte. Große Felsformationen und atmosphärischer Nebel bleiben separate mögliche Folgeschritte.

Desert-spezifische Verfeinerungen dürfen Mothership oder die eigenständige Alien-Gestaltung nicht stillschweigend ändern. Gemeinsame Felsprimitive dienen auch anderen Modellen; die Isolation ist unter [Grafik](../rendering.md#terrain-und-renderpässe) beschrieben.

Mothership besitzt eigene Hangarmodelle; seine [visuelle Abnahme](terrain.md) ist separat. Geräteprüfung unter [Playtest-Validierung](playtest-validation.md).
