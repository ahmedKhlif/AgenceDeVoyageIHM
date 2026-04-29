-- Performance indexes for date-based availability queries
CREATE INDEX IF NOT EXISTS reservations_date_range_idx ON reservations ("dateArrivee", "dateDepart");
CREATE INDEX IF NOT EXISTS reservations_chambre_statut_idx ON reservations ("chambreId", statut);
