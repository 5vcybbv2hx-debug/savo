# SAVO_ATLAS_EXPORT_V1 — Export-Format Dokumentation

## Übersicht

Export-Format `SAVO_ATLAS_EXPORT` (Schema-Version 1.0) überträgt operative Tagesdaten der SAVO Bar-App an die Controlling-App Atlas.

**Transferweg:** JSON-Datei-Download (manuell) → Import in Atlas
**Keine:** NAS, Cloud-Sync, direkte App-zu-App-Verbindung

## Meta-Felder (Header)

| Feld | Typ | Pflicht | Quelle | Bedeutung |
|------|-----|---------|--------|-----------|
| `schema_name` | string | ja | konstant | `"SAVO_ATLAS_EXPORT"` |
| `schema_version` | string | ja | konstant | `"1.0"` |
| `export_id` | string | ja | generiert | Eindeutige ID pro Export |
| `source_system` | string | ja | konstant | `"SAVO"` |
| `organisation_id` | string | ja | konstant | `"savo"` |
| `organisation_name` | string | ja | konstant | `"SAVO Lounge Club"` |
| `created_at` | string (ISO) | ja | generiert | Erstellungszeitpunkt |
| `period_from` | string (YYYY-MM-DD) | ja | User-Auswahl | Startdatum |
| `period_to` | string (YYYY-MM-DD) | ja | User-Auswahl | Enddatum |

## Summary (Komfort-Summen — Atlas muss aus Tagesdaten reproduzieren können)

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `operating_days` | number | DailyRevenue.count | Anzahl Betriebstage |
| `gross_revenue` | number | Σ DailyRevenue.revenue | Bruttoumsatz gesamt |
| `personnel_hours` | number | Σ ClockEntry.total_hours | Gesamtstunden |
| `personnel_cost` | number | Σ DailyRevenue.labor_cost_total | Personalkosten gesamt |
| `keg_changes` | number | Wastage(type=Nachtwächter).count | Fasswechsel gesamt |
| `events` | number | Event.count | Anzahl Events |

## Day-Struktur (pro Betriebstag)

### Identifikation

| Feld | Typ | Pflicht | Quelle | Bedeutung |
|------|-----|---------|--------|-----------|
| `source_record_id` | string | ja | DailyRevenue.id | Stabile Entity-ID |
| `date` | string (YYYY-MM-DD) | ja | DailyRevenue.date | Kalendertag |
| `weekday` | string | ja | berechnet | Wochentag (Montag–Sonntag) |
| `revision` | number | ja | konstant 1 | Version (bei Änderungen inkrementieren) |
| `updated_at` | string (ISO) | ja | DailyRevenue.updated_date | Letzte Aktualisierung |
| `content_hash` | string (hex) | ja | SHA-256 | Prüfsumme über Tagesdaten |

### operations

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `is_operating_day` | boolean | immer true | Tag hat Tagesabschluss |
| `busyness_level` | number (1-5) | DailyRevenue.busyness_level | Betriebsamkeit |
| `guest_count` | number | DailyRevenue.guest_count | Geschätzte Gäste |
| `staff_count` | number | DailyRevenue.staff_count | Mitarbeiteranzahl |
| `weather.*` | object | DailyRevenue.weather_* | Wetterdaten |
| `is_holiday` | boolean | DailyRevenue.is_holiday | Feiertag |
| `is_holiday_eve` | boolean | DailyRevenue.is_holiday_eve | Vorfeiertag |
| `is_bridge_day` | boolean | DailyRevenue.is_bridge_day | Brückentag |
| `is_school_vacation` | boolean | DailyRevenue.is_school_vacation | Schulferien |
| `holiday_name` | string | DailyRevenue.holiday_name | Name des Feiertags |
| `season` | string | DailyRevenue.season | Jahreszeit |
| `local_event_impact` | string | DailyRevenue.local_event_impact | Event-Einfluss |
| `closing_session.*` | object | ClosingSession | Tagesabschluss-Session |
| `tips.*` | object | TipDistribution | Trinkgeldverteilung |
| `pdf_url` | string | DailyRevenue.pdf_url | Z-Abschlag PDF URL |

### sales

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `gross_revenue` | number | DailyRevenue.revenue | Bruttoumsatz |
| `net_revenue` | number | berechnet (revenue - vat) | Nettoumsatz |
| `vat` | number | DailyRevenue.vat | Umsatzsteuer |
| `own_consumption` | number | DailyRevenue.own_consumption | Eigenbedarf |
| `cash` | number | DailyRevenue.revenue_cash | Barumsatz |
| `card` | number | DailyRevenue.revenue_ec | Kartenzahlung |
| `other` | null | — | Weitere Zahlungsarten (nicht erfasst) |
| `transaction_count` | number | SalesDataItem.count | Anzahl Artikelverkäufe |
| `revenue_by_category` | object | SalesDataItem aggregiert | Umsatz nach Warengruppen |
| `revenue_by_area` | null | — | Verkaufsbereiche (nicht erfasst) |

### payments

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `cash` | number | DailyRevenue.revenue_cash | Bar |
| `card` | number | DailyRevenue.revenue_ec | EC/Karte |
| `other` | null | — | Andere (nicht erfasst) |

### personnel

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `total_hours` | number | Σ ClockEntry.total_hours | Gesamtstunden |
| `total_cost` | number | DailyRevenue.labor_cost_total | Personalkosten gesamt |
| `employees[]` | array | ClockEntry + Employee | Pro Mitarbeiter |
| `employees[].employee_id` | string | ClockEntry.employee_id | Employee ID |
| `employees[].name` | string | ClockEntry.employee_name | Name |
| `employees[].role` | string | Employee.role | Rolle |
| `employees[].hours` | number | Σ ClockEntry.total_hours | Stunden |
| `employees[].hourly_rate` | number | Employee.hourly_rate | Stundensatz |
| `employees[].cost` | number | berechnet (hours * rate) | Kosten |

### beer_and_kegs

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `keg_changes[]` | array | Wastage(type=Nachtwächter) | Fasswechsel (Bierleitungsspülung) |
| `keg_changes[].product_name` | string | Wastage.article_name | Artikelname |
| `keg_changes[].quantity` | number | Wastage.quantity | Menge (Verlust) |
| `keg_changes[].unit` | string | Wastage.unit | Einheit |

### events[]

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `event_id` | string | Event.id | Event ID |
| `name` | string | Event.title | Event-Name |
| `type` | string | Event.event_type | Event-Typ |
| `status` | string | Event.status | Status |
| `expected_guests` | number | Event.expected_guests | Erwartete Gäste |
| `actual_guests` | number | Event.actual_guests | Tatsächliche Gäste |
| `entry_fee` | number | Event.entry_fee | Eintritt |
| `budget` | number | Event.budget | Budget |
| `revenue` | null | — | Event-Umsatz (nicht separat erfasst) |
| `personnel_hours` | null | — | Personalstunden (nicht direkt zuordenbar) |

### inventory

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `sessions[]` | array | InventorySession | Inventur-Sessions |
| `sessions[].session_id` | string | InventorySession.id | ID |
| `sessions[].counted_by` | string | InventorySession.counted_by | Gezählt von |
| `sessions[].total_items` | number | InventorySession.total_items | Anzahl Artikel |
| `sessions[].total_difference` | number | InventorySession.total_difference | Differenz |
| `wastage[]` | array | Wastage (ohne Nachtwächter) | Schwund |
| `wastage[].article_name` | string | Wastage.article_name | Artikel |
| `wastage[].quantity` | number | Wastage.quantity | Menge |
| `wastage[].unit` | string | Wastage.unit | Einheit |
| `wastage[].type` | string | Wastage.type | Schwundart (Bruch, Verderb, Sonstiges) |

### notes[]

| Feld | Typ | Quelle | Bedeutung |
|------|-----|--------|-----------|
| `type` | string | "daily_closing" / "closing_session" | Notiztyp |
| `text` | string | DailyRevenue.notes / ClosingSession.notes | Notiztext |

## Verwendete SAVO-Entities

1. **DailyRevenue** — Umsatz, Zahlungsarten, Steuer, Wetter, Notizen, Personalkosten-Summe
2. **ClockEntry** — Arbeitszeiten pro Mitarbeiter (clock_in Datum-Filter)
3. **TimeEntry** — Fallback für Arbeitszeiten (wenn keine ClockEntries)
4. **Employee** — Stundensätze, Rollen (hourly_rate, monthly_salary, role)
5. **Event** — Events pro Tag
6. **ClosingSession** — Tagesabschluss-Session-Details
7. **Wastage** — Schwund (type ≠ Nachtwächter) + Fasswechsel (type = Nachtwächter)
8. **TipDistribution** — Trinkgeldverteilung pro Tag
9. **InventorySession** — Inventur-Sessions
10. **SalesDataItem** — Artikelverkäufe pro Tag → revenue_by_category, transaction_count

## Nicht exportierte Daten

- Umsatz nach Verkaufsbereichen (nicht in SAVO erfasst)
- Event-Umsatz (nicht separat zugeordnet)
- Event-Personalstunden (nicht direkt zuordenbar)
- Persönliche Mitarbeiterdaten (IBAN, Steuer-ID, etc.)
- CashbookEntry (Buchhaltungs-Details — Atlas erhält nur operative Tagesdaten)
- OpeningSession (nur ClosingSession exportiert)

## content_hash Berechnung

SHA-256 über JSON-String von:
```json
{
  "date": "...",
  "sales": {...},
  "personnel": { "total_hours": ..., "total_cost": ..., "employee_count": ... },
  "beer_and_kegs": {...},
  "events": <count>,
  "notes": <count>,
  "updated_at": "..."
}
```

Atlas kann damit erkennen:
- Neuer Tagesabschluss (neue source_record_id)
- Identisch bereits vorhanden (gleicher content_hash)
- Nachträglich verändert (unterschiedlicher content_hash bei gleicher source_record_id)
