# Ashes of Meridian

Eigenständiger statischer Spiel-Prototyp, ohne Nuxt oder npm-Abhängigkeiten. `index.html` enthält Renderer und Simulation; die Bilddateien liegen daneben.

## Lokal starten

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Anschließend `http://127.0.0.1:8080/` öffnen.

## Tests

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-{terrain,crystals}.check.cjs
```

Bisherige Implementierungs- und Prüfnotizen: [docs/bisheriger-pruefstand.md](docs/bisheriger-pruefstand.md).
