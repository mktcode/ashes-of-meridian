# Raffinerie direkt auf dem Aether Vent platzieren

Die Platzierung darf innerhalb von 6 Metern um einen erkundeten Aether Vent angesetzt werden. Vorschau, Validierung, Worker-Ziel und bezahltes Fundament rasten auf das tatsächliche Vent-Zentrum ein; außerhalb des Fangradius bleibt die Vorschau am Zeiger und ungültig. Tote oder bereits belegte Vents werden dadurch nicht freigegeben.

Die gemeinsame Positionierung wird von Spieler und KI verwendet. Die KI prüft direkt die Zentren beobachteter Vents statt 64 versetzte Kandidaten je Vent. Der allgemeine Bauvalidator schützt dort weiterhin Einheitenkörper, Produktionsausgänge, Gelände und andere Strukturen.

Die vorhandenen zentral ausgerichteten Raffineriehüllen aller Fraktionen und der gemeinsame `renderEntity`-Transform bleiben unverändert; das Vent-Modell wird am selben Weltzentrum weiter gezeichnet. Die technische Umsetzung braucht noch menschliche visuelle Abnahme für Modellüberlagerung und Bediengefühl. Die neuen Simulations- und autonomen Wirtschaftsnachweise wurden gemäß Opt-in-Regel noch nicht gestartet.
