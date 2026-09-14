# Echte Geräte und vollständige Runs validieren

Der Core Loop ist implementiert; menschliche Bedienbarkeit, Langzeitbalancing und Echtgeräte-Performance sind noch nicht ausreichend validiert. Prüfprioritäten, kein pauschaler Auftrag für neue Systeme oder Balancingänderungen.

## Offene Prüfungen

1. **Mobilbedienung:** kleine HUD-Knöpfe/Texte, Tap-Folgen unter Last, Pan/Pinch, Minimap, Untermenüs/Scrollen und Zielplatzierung. Hoch-/Querformatwechsel und Rückkehr aus dem Hintergrund berücksichtigen.
2. **Vollständige menschliche Runs:** Einstieg ohne Startworker, mehrere Siege mit Vorteilswahl, Übergang über Upgrades sowie Niederlage/Abbruch spielen. Wiederaufnahme nach Reload am Übergang und Fraktionsfreischaltungen bei Tiefe 10/25 prüfen. Worker-Gegenverkehr, Produktionsausgänge und größere Armeen auf Engstellen beobachten.
3. **Progression und Schwierigkeit:** Aether-Erträge, Evakuierungslimits, Upgradepreise, Vorteilsstapel und Gegnerdruck über längere Expeditionen bewerten. Nach Umsetzung der geplanten [Fraktionsdoktrinen und Tiefenskalierung](expeditions-schwierigkeit-und-upgrades.md) insbesondere Erkennbarkeit, Druckstufen und dominante Kombinationen vergleichen. Die größere Alien-Karte hat längere Wege und bewusst andere Ressourcenlagen; Motherships offene Deckachse auf frühen Gegnerdruck prüfen. Automatische KI-Partien sind kein Nachweis ausgewogener menschlicher Schwierigkeit.
4. **Reale GPUs/Browser:** Framerate, Start-/Weltwechselkosten, Wärme/Akku und Speicherdruck, insbesondere große Karten, dichte Vegetation und große Armeen. Verdeckung durch Berge/Baumkronen/Hangardächer sowie High/Balanced/Performance visuell beurteilen.
5. **Profil und Lebenszyklus:** Profil und separaten Expeditionscheckpoint unter `file://` und Webhosting sowie Pause/Hintergrundwechsel und Audio prüfen. Reload, Seitenverwerfen und Grafikverlust müssen das laufende Gefecht verwerfen, aber den letzten Übergang erhalten; Niederlage und Abbruch müssen den Checkpoint löschen.

Vorhandene Node-Regression und Chromium-/Software-WebGL-Sichtungen sind technische Vorprüfungen, keine Echtgeräte-, Hör- oder menschliche Langzeitabnahme. Frühere Messreihen bleiben in Git. Neue relevante Befunde hier knapp mit Gerät/Browser, Spielsituation und Ergebnis festhalten; daraus konkrete Folgeissues ableiten.

Bekannte Einschränkungen bei der Bewertung berücksichtigen: [Bauplätze über Einheiten](bug-building-placement-in-einheiten.md), [Raffinerie/Vent](aether-vent-und-refinary-bauen.md), offene [Desert-Gestaltung](desert-map.md) und [Mothership-Abnahme](terrain.md).
