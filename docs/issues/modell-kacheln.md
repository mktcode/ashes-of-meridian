# Modellkacheln: Lesbarkeit und Performance

Nutzer meldete beim Öffnen von Codex/Baumenü Einbruch von 60 auf 30 FPS oder weniger; Gerät/Browser/Diagnose fehlen. Kleine Kacheln sind inzwischen statisch gecacht, große Detailansicht bleibt live. Erstaufnahme kann weiter synchronisieren; [Cache-/Rendervertrag](../rendering.md#modellkacheln).

- [ ] Erst-/Wiederöffnen auf betroffenem Desktop und Mobilgerät vergleichen, bei Kosten [Diagnose](../testing.md#lokale-performancediagnose) mit Pass `thumbnails` sichern. CPU-Layoutkosten der regelmäßigen Sichtbarkeitsprüfung getrennt von kalter GPU-/Canvas-Kopie betrachten; [Optimierungsplan](mobile-performance.md#p3--weitere-spitzen-gezielt-statt-pauschal-angehen).
- [ ] Modellgröße/-ausschnitt, Teamfarben, Kontrast/Kanten, Namen/Kosten und deaktivierte Aktionen in Codex/HUD.
- [ ] Erstmaliges Einblenden und sofortige Cache-Wiederanzeige im Firefox sowie mit reduzierter Bewegung visuell abnehmen.
- [ ] Scrollen/Tippen auf Smartphone unter Last, nicht nur arrangiertes Standbild.

Korrektur zu kleiner Gebäudemodelle ist integriert, menschliche Wiederabnahme offen.
