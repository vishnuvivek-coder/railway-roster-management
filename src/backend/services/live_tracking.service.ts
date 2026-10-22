import { get, all, run } from '../db';
import { ApiError } from '../utils/api_error';
import {
  syncJourneyLegsMultiSource,
  fetchMultiSourceTrainTimings
} from './multi_source_tracker';

export async function syncMultiTrainTimings(data: { legs: any[]; forceRefresh?: boolean }) {
  const { legs, forceRefresh } = data;
  if (!Array.isArray(legs)) {
    throw new ApiError(400, 'Array of journey legs required.');
  }

  const shouldForce = forceRefresh !== false;
  const updatedLegs = await syncJourneyLegsMultiSource(legs, { get, all, run }, shouldForce);
  return { success: true, legs: updatedLegs, engine: 'Official NTES & Live Railway Tracker' };
}

export async function syncNtesTrainTimings(data: { legs: any[]; forceRefresh?: boolean }) {
  const { legs, forceRefresh } = data;
  if (!Array.isArray(legs)) {
    throw new ApiError(400, 'Array of journey legs required.');
  }

  const shouldForce = forceRefresh !== false;
  const updatedLegs = await syncJourneyLegsMultiSource(legs, { get, all, run }, shouldForce);
  return { success: true, legs: updatedLegs, engine: 'Official NTES & Live Railway Tracker' };
}

export async function getMultiTrainTimings(trainNo: string, dateIso?: string) {
  const date = dateIso || new Date().toISOString().split('T')[0];
  const timings = await fetchMultiSourceTrainTimings(trainNo, date, { get, all, run }, true);
  return { success: true, train_no: trainNo, date, stations: timings, engine: 'Multi-Source Live Tracker' };
}

export async function getNtesTrainTimings(trainNo: string, dateIso?: string) {
  const date = dateIso || new Date().toISOString().split('T')[0];
  const timings = await fetchMultiSourceTrainTimings(trainNo, date, { get, all, run }, true);
  return { success: true, train_no: trainNo, date, stations: timings, engine: 'Official NTES & Live Tracker' };
}
