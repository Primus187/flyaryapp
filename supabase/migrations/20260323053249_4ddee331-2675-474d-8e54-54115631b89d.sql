
-- Backfill altitude_gain from IGC track data (nested {points: [...]} with "altitude" key)
UPDATE flights f
SET altitude_gain = sub.calc_gain
FROM (
  SELECT it.flight_id,
    (SELECT MAX((p->>'altitude')::int) - MIN((p->>'altitude')::int)
     FROM jsonb_array_elements(it.track_data->'points') AS p
     WHERE (p->>'altitude') IS NOT NULL
    ) AS calc_gain
  FROM igc_tracks it
  WHERE it.track_data IS NOT NULL
    AND jsonb_typeof(it.track_data) = 'object'
    AND it.track_data ? 'points'
    AND jsonb_typeof(it.track_data->'points') = 'array'
    AND jsonb_array_length(it.track_data->'points') > 0
) sub
WHERE f.id = sub.flight_id
  AND f.altitude_gain IS NULL
  AND sub.calc_gain IS NOT NULL
  AND sub.calc_gain > 0;

-- Backfill remaining flights from location altitudes (takeoff - landing)
UPDATE flights f
SET altitude_gain = GREATEST(0, tl.altitude - ll.altitude)
FROM locations tl, locations ll
WHERE f.takeoff_location_id = tl.id
  AND f.landing_location_id = ll.id
  AND f.altitude_gain IS NULL
  AND tl.altitude IS NOT NULL
  AND ll.altitude IS NOT NULL;
