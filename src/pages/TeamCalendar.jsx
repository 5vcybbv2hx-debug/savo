import { Navigate } from 'react-router-dom';

/**
 * Teamkalender — wurde in den Schichtplan (Calendar) als Monat-Brille integriert.
 * Diese Seite leitet auf /Calendar?view=monat weiter, damit bestehende Links und
 * Nav-Einträge erhalten bleiben. Die Monat-Ansicht selbst lebt in TeamMonthView.
 */
export default function TeamCalendar() {
    return <Navigate to="/Calendar?view=monat" replace />;
}