// Shapes of the MusicBrainz Web Service (https://musicbrainz.org/doc/MusicBrainz_API)
// JSON responses this integration consumes. Field names/types follow the
// official docs exactly, only the fields we actually use are modeled — no
// invented fields, no domain concepts of ours in this file (same criterion
// as setlist-fm.types.ts).

// primary-type/secondary-types are open vocabularies on MusicBrainz's side
// (new values can appear); we only special-case the ones
// musicbrainz-sync.service.ts actually filters on, so this stays a plain
// string rather than a union that could reject a real response.
export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'primary-type': string | null;
  'secondary-types'?: string[];
  'first-release-date'?: string; // "", "yyyy", "yyyy-MM" or "yyyy-MM-dd" — MusicBrainz dates can be partial
}

// Envelope returned by GET /ws/2/release-group?artist={mbid}.
export interface MusicBrainzReleaseGroupsPage {
  'release-group-count': number;
  'release-group-offset': number;
  'release-groups': MusicBrainzReleaseGroup[];
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string; // "Official" is what we prefer — see resolveRepresentativeRelease
}

// Envelope returned by GET /ws/2/release-group/{id}?inc=releases.
export interface MusicBrainzReleaseGroupWithReleases {
  id: string;
  title: string;
  releases: MusicBrainzRelease[];
}

export interface MusicBrainzRecording {
  id: string; // the recording MBID — what Song.mbid stores (see musicbrainz-sync.service.ts)
  title: string;
}

export interface MusicBrainzTrack {
  id: string; // track id, distinct from recording.id — never used, kept for completeness
  position: number;
  title: string;
  recording: MusicBrainzRecording;
}

export interface MusicBrainzMedium {
  position: number;
  tracks: MusicBrainzTrack[];
}

// Envelope returned by GET /ws/2/release/{id}?inc=recordings.
export interface MusicBrainzReleaseWithRecordings {
  id: string;
  title: string;
  media: MusicBrainzMedium[];
}
