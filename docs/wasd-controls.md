# Tastatursteuerung

WASD bewegt die Kamera, F aktiviert Attack-Move. Pfeiltasten bewegen die Kamera nicht. Kein Umschalter und keine Sonderbehandlung alter Profile.

Ctrl+A wählt die Armee, Ctrl+S speichert; diese Kombinationen schwenken nicht die Kamera. Shift+WASD funktioniert. Fokus auf Eingabefeldern, Pause und das Loslassen der Tasten werden berücksichtigt.

Node-Tests prüfen Richtungen, Wiederholung, Modifier, Fokus, Pause, Befehle und Hinweise. Tatsächliche Tastaturereignisse wurden in Chromium unter `file://` geprüft. [Gesamtprüfstand](testing.md).
