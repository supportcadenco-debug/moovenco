-- Ajout de la date d'expiration du permis de conduire dans driver_details
ALTER TABLE driver_details
  ADD COLUMN IF NOT EXISTS permis_expiry DATE;
