import { Select } from "@/components/ui/select";

export type MatchVenueOption = { id: string; name: string };

export function MatchVenueSelect({
  venues,
  defaultVenueId,
  currentVenue
}: {
  venues: MatchVenueOption[];
  defaultVenueId?: string | null;
  currentVenue?: { id: string | null; label: string | null };
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="venueId">
        Cancha
      </label>
      <Select defaultValue={currentVenue ? "keep" : defaultVenueId ?? ""} id="venueId" name="venueId">
        {currentVenue ? <option value="keep">{currentVenue.label ?? "Cancha por confirmar"}</option> : null}
        {!currentVenue || currentVenue.label ? <option value="">Cancha por confirmar</option> : null}
        {venues.filter((venue) => venue.id !== currentVenue?.id).map((venue) => (
          <option key={venue.id} value={venue.id}>{venue.name}</option>
        ))}
      </Select>
    </div>
  );
}
