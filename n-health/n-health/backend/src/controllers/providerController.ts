import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { withDistanceSorted } from '../utils/geo';

/** Parses optional ?lat=&lng= query params shared by every directory endpoint. */
function parseCoords(req: Request): { lat?: number; lng?: number } {
  const lat = req.query.lat !== undefined ? parseFloat(String(req.query.lat)) : undefined;
  const lng = req.query.lng !== undefined ? parseFloat(String(req.query.lng)) : undefined;
  return { lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined };
}

export async function listDoctors(req: Request, res: Response) {
  const { specialty } = req.query;
  const { lat, lng } = parseCoords(req);
  const doctors = await prisma.doctorProfile.findMany({
    where: specialty ? { specialty: { contains: String(specialty), mode: 'insensitive' } } : undefined,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: lat === undefined ? { rating: 'desc' } : undefined,
  });
  res.json(withDistanceSorted(doctors, lat, lng));
}

export async function listPharmacies(req: Request, res: Response) {
  const { lat, lng } = parseCoords(req);
  const pharmacies = await prisma.pharmacyProfile.findMany({
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json(withDistanceSorted(pharmacies, lat, lng));
}

export async function listLabs(req: Request, res: Response) {
  const { lat, lng } = parseCoords(req);
  const labs = await prisma.labProfile.findMany({
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json(withDistanceSorted(labs, lat, lng));
}

export async function listAvailableAmbulances(req: Request, res: Response) {
  const { lat, lng } = parseCoords(req);
  const ambulances = await prisma.ambulanceProfile.findMany({
    where: { isAvailable: true },
    include: { user: { select: { id: true, name: true } } },
  });
  // Ambulances track live position (currentLat/currentLng) rather than a
  // fixed address, so map that onto the shared lat/lng shape before sorting.
  const shaped = ambulances.map((a: { currentLat: number | null; currentLng: number | null }) => ({
    ...a,
    lat: a.currentLat,
    lng: a.currentLng,
  }));
  res.json(withDistanceSorted(shaped, lat, lng));
}

export async function listAvailableNurses(req: Request, res: Response) {
  const nurses = await prisma.nurseProfile.findMany({
    where: { isAvailable: true },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json(nurses);
}

export async function pharmacyInventory(req: Request, res: Response) {
  const items = await prisma.inventory.findMany({
    where: { pharmacyId: req.params.pharmacyId, stock: { gt: 0 } },
    orderBy: { name: 'asc' },
  });
  res.json(items);
}
