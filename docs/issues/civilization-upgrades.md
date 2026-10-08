# Zivilisationsupgrades: Integration und Abnahme

Die verbindlichen [Spielregeln](../gameplay.md#wirtschaft-bau-und-produktion) beschreiben Gebäudeauswahl, Echo-Ausbau, weltübergreifende Stapel und eingefrorene Gefechtsrezepte. Keine Migration alter Profil-/Expeditionsstände.

## Technische Restarbeit

- [ ] Langtest-Fixtures in `tests/ashes-of-meridian-simulation.check.cjs` auf Startrezepte statt `profile.upgrades` umstellen; frühere permanente Rang-/Vorteilscaps entsprechen nicht mehr den neuen Gebäude-Stapeln. Die entfernten Regeln nicht durch Kompatibilitätsadapter wieder einführen. Feste RNG-/Terrainreferenzen nicht zum Grünmachen regenerieren. Änderungen und gezielte Ausführung dieses Simulationsblocks separat freigeben.
- [ ] Präsentationsfixtures und noch nicht ausgeführte Eingabe-/Stage-World-Fälle auf verbliebene alte Annahmen prüfen. Angepasste lokale Verträge sind keine vollständige Integrationsabnahme.
- [ ] Lokales Asset für den unabhängigen Harness-Musiktest bereitstellen: `music-drafts/06-sporewake.mp3` fehlt im Feature-Worktree (`ENOENT` bei `battle playlist starts after ten seconds…`). Test nicht überspringen und keine Ersatzaufnahme erfinden.
- [ ] Verwaiste Fleet-/Benefit-Styles im gemeinsamen Designsystem gezielt bereinigen; keine gleichzeitig veränderte Gestaltung anderer Ansichten.
- [ ] Breite Integrationsprüfung erst nach gesonderter Freigabe. Gezielte CPU-Fälle schützen Upgrade-Kosten, Ausbau/KP, Stapel/Einmaligkeit, Vent-Erschöpfung, Formatvalidierung und Gefechts-Snapshots. Der echte UI-Lebenszyklusfall prüft insbesondere den Besuch einer alten Welt mit Upgrade-Änderung, während ein anderes Gefecht gespeichert ist.

## Menschliche Abnahme und Balance

- [ ] Einmaligen Hinweis beim ersten **Continue building** auf schmalen/niedrigen Geräten abnehmen: Forum-Lieferung, Echo-Upgrades und nur neue Gefechte verständlich; **Back** ohne Bestätigung und **Start building** ohne Ladebildschirm/Pausemenü. Gezielte CPU-/UI-Verträge prüfen Profilbestätigung, erhaltene Live-Welt/RNG, entferntes feindliches Restfeuer, getrenntes Welt-Speicherziel und Schutz vor erneuter Siegwertung; visuelle/akustische Abnahme bleibt offen.

- [ ] Iconraster und scrollfreie Detailansicht auf schmalen und niedrigen Echtgeräten abnehmen: neun Wohn-/zwölf Forschungsicons, freies Detail-Icon und X zur Rückkehr, bewusste Aktivierung vor Rang-Ausbau, vollständige Beschreibungen, Auswahlzeile/Minimap und Rückkehr zu normalen Aktionen. Zwei gezielte UI-Fälle prüfen Slotgrenze/Familien, getrennte Vorschau und Kauf, Rank-Aktion nach Aktivierung und Pause-Sperre; visuelle Abnahme und Grenzen der nach oben wachsenden Details bleiben offen.
- [ ] Upgrade-Kosten und endlichen Vent-Vorrat abstimmen. Erste Parameter sind 40/80/140 Echo und 900 Echo je Vent; Effektstärken bleiben zunächst an den bisherigen Boni orientiert, nicht anhand vollständiger Runs neu ausbalanciert.
- [ ] Grenzen für Stapel, Zusatzworker, Command-Ränge und Reparaturrabatt prüfen. Einige Effekte behalten technische Obergrenzen; freie Effektwechsel und das Behalten gekaufter Ränge beim Leeren sind vorläufige Bedienentscheidungen.
- [ ] Einmalige Effekte auf ausgebauten Gebäuden verständlich behandeln: zusätzliche Ränge verstärken sie nicht. Ob hierfür Ausbau gesperrt, eine Warnung ergänzt oder eine andere Rangwirkung gewünscht ist, entscheiden.
- [ ] Ausreichende Siedlungsfläche trotz vollständiger Erstbau-Reservierung, erreichbare Forum-Lieferungen sowie Cinder-/Echo-Reste nach knappen Siegen mit echten Runs prüfen. Keine automatische Ressourcenrettung oder garantierte maximale Gebäudezahl.

Kosten umfangreicher Archive, wiederholter Upgrade-Aggregation und Speicherung stehen zentral unter [Performance](performance/README.md#verbleibende-cpu-spitzen); korrekte Wiederbesuche und getrennte Save-Ziele unter [Spielstandsabnahme](expeditions-spielstand.md).

KI-Partien, umfassende Simulationen und vollständige menschliche Runs sind noch nicht abgenommen. Diese Liste ist keine Freigabe für autonome Langtests oder neue Balancekorrekturen.
