// Shared data model for movement datasets flowing through the app.

export interface TrackPoint {
	individualId: string;
	timestampMs: number; // epoch ms, UTC
	lat: number;
	lon: number;
}

export type DatasetSource = 'upload' | 'movebank' | 'sample';

export interface Dataset {
	id: string;
	studyId?: string;
	studyName?: string;
	species: string;
	source: DatasetSource;
	licenseType?: string;
	points: TrackPoint[];
}

export interface DatasetSummary {
	individualIds: string[];
	startMs: number;
	endMs: number;
	minLat: number;
	maxLat: number;
	minLon: number;
	maxLon: number;
	totalPoints: number;
	/** cumulative great-circle distance per individual, in kilometers */
	distanceKmByIndividual: Record<string, number>;
	totalDistanceKm: number;
}

export interface MovebankStudySummary {
	studyId: string;
	studyName: string;
	species: string;
	sensorType: string;
	numberOfEvents: number;
	licenseType: string;
}
