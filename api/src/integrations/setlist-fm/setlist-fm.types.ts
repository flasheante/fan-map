// Shapes of the setlist.fm REST API 1.0 JSON responses this integration
// consumes. Field names/types follow the official docs exactly
// (https://api.setlist.fm/docs/1.0/), only the fields we actually use are
// modeled — no invented fields, no domain concepts of ours in this file.

export interface SetlistFmCoords {
  lat: number;
  long: number;
}

export interface SetlistFmCountry {
  code: string; // ISO country code, e.g. "mx"
  name: string;
}

export interface SetlistFmCity {
  id: string;
  name: string;
  stateCode?: string;
  state?: string;
  coords?: SetlistFmCoords;
  country: SetlistFmCountry;
}

export interface SetlistFmVenue {
  id: string;
  name: string;
  city?: SetlistFmCity;
  url?: string;
}

export interface SetlistFmArtist {
  mbid: string;
  name: string;
  sortName?: string;
  disambiguation?: string;
  url?: string;
}

export interface SetlistFmSong {
  name: string;
  with?: SetlistFmArtist;
  cover?: SetlistFmArtist;
  info?: string;
  tape?: boolean;
}

export interface SetlistFmSet {
  name?: string;
  encore?: number;
  song: SetlistFmSong[];
}

export interface SetlistFmTour {
  name?: string;
}

// One entry of /1.0/artist/{mbid}/setlists. Despite the name, this
// represents a concert event: `sets.set` may be an empty array (or `sets`
// itself may be omitted) when no songs have been logged for it yet.
export interface SetlistFmSetlist {
  id: string; // stable across edits — identifies the concert, not the edit
  versionId: string; // changes on every edit of this setlist's content
  eventDate: string; // "dd-MM-yyyy"
  lastUpdated?: string; // "yyyy-MM-dd'T'HH:mm:ss.SSSZZZZZ"
  artist: SetlistFmArtist;
  venue: SetlistFmVenue;
  tour?: SetlistFmTour;
  sets?: { set: SetlistFmSet[] };
  info?: string;
  url: string;
}

// Envelope returned by GET /1.0/artist/{mbid}/setlists.
export interface SetlistFmSetlistsPage {
  setlist: SetlistFmSetlist[];
  total: number;
  page: number;
  itemsPerPage: number;
}
