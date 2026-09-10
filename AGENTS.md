# Hinweise für KI-Assistenten

- Statisches Spiel: Renderer und Simulation sind in `index.html` eingebettet; Assets liegen daneben.
- Terrain- und Kristallmodelle mit `node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-{terrain,crystals}.check.cjs` prüfen.
- Visuelle Änderungen dürfen die seedbasierte Hindernisverteilung bestehender Spielstände nicht unbeabsichtigt verändern.
- Implementierungs- und Prüfnotizen gehören unter `docs/`.
