const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface City {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: Country;
}

export interface FanProfileOnMap {
  id: string;
  displayName: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
  city: City;
}

export async function getFanProfilesOnMap(): Promise<FanProfileOnMap[]> {
  const res = await fetch(`${API_URL}/fan-profiles?onMap=true`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch fan profiles: ${res.status}`);
  }

  return res.json();
}
