import React from 'react';

/**
 * AGB-Inhalt (aus pages/AGB.jsx migriert).
 * Wird im Rechtliches-Tab (MyArea) innerhalb eines Accordion angezeigt.
 */
export default function AGBContent() {
  return (
    <div className="space-y-6 text-foreground">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Anwendungsbereich</h2>
        <p className="text-sm text-muted-foreground">
          Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der BarManager-App durch autorisierte Mitarbeiter und Betreiber.
          Die Nutzung der App setzt die Akzeptanz dieser AGB voraus.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Nutzungsrechte</h2>
        <p className="text-sm text-muted-foreground">
          Die App wird zur Verfügung gestellt für interne Geschäftszwecke. Eine Weitergabe an unbefugte Personen ist untersagt.
          Alle Inhalte, Funktionen und Daten der App sind Eigentum des Betreibers.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Pflichten der Nutzer</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Schutz der Zugangsdaten und PINs</li>
          <li>• Keine Nutzung durch unbefugte Personen</li>
          <li>• Einhaltung geltender Gesetze und Betriebsvorgaben</li>
          <li>• Sofortige Meldung von Sicherheitsverletzungen</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Datensicherheit</h2>
        <p className="text-sm text-muted-foreground">
          Der Nutzer akzeptiert die Speicherung und Verarbeitung persönlicher Daten gemäß Datenschutzerklärung.
          Alle Zugriffe werden protokolliert.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">5. Haftung</h2>
        <p className="text-sm text-muted-foreground">
          Der Anbieter haftet nicht für Datenverluste oder Ausfallzeiten, soweit nicht durch Fahrlässigkeit verursacht.
          Der Nutzer trägt Verantwortung für seine Zugangsdaten.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. Änderungen</h2>
        <p className="text-sm text-muted-foreground">
          Der Anbieter behält sich das Recht vor, diese AGB zu ändern. Änderungen werden dem Nutzer mitgeteilt.
          Weitere Nutzung nach Änderungen gilt als Akzeptanz.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">7. Kündigung</h2>
        <p className="text-sm text-muted-foreground">
          Der Anbieter kann den Zugriff jederzeit ohne Grund einschränken oder beenden.
          Bei Beendigung werden alle Zugangsdaten ungültig.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">8. Schlussbestimmungen</h2>
        <p className="text-sm text-muted-foreground">
          Sollte eine Bestimmung ungültig sein, bleibt der Rest gültig.
          Diese AGB unterliegen deutschem Recht.
        </p>
      </section>

      <p className="text-xs text-muted-foreground pt-2">
        <strong>Letzte Aktualisierung:</strong> 01.04.2026
      </p>
    </div>
  );
}