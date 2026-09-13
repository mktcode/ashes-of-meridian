# Raffinerie direkt auf dem Aether Vent platzieren

Derzeit wird die Raffinerie in Vent-Nähe gebaut. Da nur eine pro Vent erlaubt ist, soll sie direkt auf dem Vent stehen müssen.

Dabei die vorhandenen Raffineriehüllen aller Fraktionen und den gemeinsamen `renderEntity`-Transform berücksichtigen, nicht nur die UI-Vorschau verschieben. Modellgröße, Vent-Modell, Kollision und zugehörige Portraits gezielt beurteilen.

Die KI verwendet dieselben Bau-/Ventprüfungen, sucht aber Positionen im bisherigen Umkreis beobachteter Vents. Direkte Platzierung erfordert daher auch angepasste Kandidatensuche in `src/simulation/ai.ts` und passende autonome Wirtschaftstests. Mit dem [allgemeinen Bauplatzfehler](bug-building-placement-in-einheiten.md) abstimmen; keine getrennten Platzierungsregeln für UI und KI.
