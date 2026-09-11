# Tastatursteuerung (historisch)

Dieser Bericht beschreibt die frühere WASD-Umstellung. Die Desktop-Kamerasteuerung ist inzwischen entfernt; aktueller Stand und neue Prüfungen: [Mobile-Kamera](mobile-camera-cleanup.md). Die folgenden Angaben sind kein aktueller Bedienungs- oder Testnachweis.

WASD bewegt die Kamera, F aktiviert Attack-Move. Pfeiltasten bewegen die Kamera nicht. Kein Umschalter und keine Sonderbehandlung alter Profile.

Ctrl+A wählt die Armee, Ctrl+S speichert; diese Kombinationen schwenken nicht die Kamera. Shift+WASD funktioniert. Fokus auf Eingabefeldern, Pause und das Loslassen der Tasten werden berücksichtigt.

Node-Tests prüfen Richtungen, Wiederholung, Modifier, Fokus, Pause, Befehle und Hinweise. Tatsächliche Tastaturereignisse wurden in Chromium unter `file://` geprüft. [Gesamtprüfstand](testing.md).
