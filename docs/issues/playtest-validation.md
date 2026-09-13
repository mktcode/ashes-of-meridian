# Echte Geräte und vollständige Runs validieren

Der Core Loop ist implementiert; menschliche Bedienbarkeit, Langzeitbalancing und Echtgeräte-Performance sind noch nicht ausreichend validiert. Prüfprioritäten, kein pauschaler Auftrag für neue Systeme oder Balancingänderungen.

## Offene Prüfungen

1. **Mobilbedienung:** kleine HUD-Knöpfe/Texte, Tap-Folgen unter Last, Pan/Pinch, Minimap, Untermenüs/Scrollen und Zielplatzierung. Hoch-/Querformatwechsel und Rückkehr aus dem Hintergrund berücksichtigen.
2. **Vollständige menschliche Runs:** Einstieg ohne Startworker bis Sieg/Niederlage, Ergebnis → Upgrades → Ergebnis/Neustart und Fraktionsfreischaltung spielen. Worker-Gegenverkehr, Produktionsausgänge und größere Armeen auf Engstellen beobachten.
3. **Progression und Schwierigkeit:** Aether-Erträge, Evakuierungslimits, Upgradepreise und Gegnerdruck über Fraktionen und Upgrade-Stufen bewerten. Die größere Alien-Karte hat längere Wege und bewusst andere Ressourcenlagen; automatische KI-Partien sind kein Nachweis ausgewogener menschlicher Schwierigkeit.
4. **Reale GPUs/Browser:** Framerate, Start-/Weltwechselkosten, Wärme/Akku und Speicherdruck, insbesondere große Karten, dichte Vegetation und große Armeen. Verdeckung durch Berge/Baumkronen sowie High/Balanced/Performance visuell beurteilen.
5. **Profil und Lebenszyklus:** Speicherung unter `file://` und Webhosting, Pause/Hintergrundwechsel und Audio prüfen. Kein Fortsetzen eines Runs nach Reload, Seitenverwerfen oder Grafikverlust zugesagt.

Vorhandene Node-Regression und Chromium-/Software-WebGL-Sichtungen sind technische Vorprüfungen, keine Echtgeräte-, Hör- oder menschliche Langzeitabnahme. Frühere Messreihen bleiben in Git. Neue relevante Befunde hier knapp mit Gerät/Browser, Spielsituation und Ergebnis festhalten; daraus konkrete Folgeissues ableiten.

Bekannte Einschränkungen bei der Bewertung berücksichtigen: [Bauplätze über Einheiten](bug-building-placement-in-einheiten.md), [Raffinerie/Vent](aether-vent-und-refinary-bauen.md), offene [Desert-](desert-map.md) und [Mothership-Gestaltung](terrain.md).
