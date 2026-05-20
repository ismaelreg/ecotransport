
export interface Route {
  origin: { lat: number; lng: number; address: string } | null;
  destination: { lat: number; lng: number; address: string } | null;
  distanceKm: number;
}

export interface CargoItem {
  id: string;
  name: string;
  length: number; // in cm
  width: number;  // in cm
  height: number; // in cm
  weight: number; // in kg
  quantity: number;
  color: string;
  stackable: boolean;
  tiltable: boolean;
}

export interface PlacedItem extends CargoItem {
  position: [number, number, number];
}

export interface Container {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  type: 'container' | 'truck' | 'pallet' | 'trailer' | 'platform';
  image?: string;
}

export const CONTAINERS: Container[] = [
  { id: '20ft', name: "Contenedor 20'", length: 589, width: 235, height: 239, maxWeight: 28200, type: 'container' },
  { id: '40ft', name: "Contenedor 40'", length: 1203, width: 235, height: 239, maxWeight: 26600, type: 'container' },
  { id: '40hc', name: "Contenedor 40' HC", length: 1211, width: 238, height: 269, maxWeight: 29600, type: 'container' },
  { id: 'truck2', name: 'Camion rigido 2 ejes', length: 612, width: 240, height: 230, maxWeight: 11300, type: 'truck' },
  { id: 'trailer2', name: 'Remolque urbano 2 ejes', length: 530, width: 240, height: 240, maxWeight: 5800, type: 'trailer' },
  { id: 'pallet_euro', name: 'Pallet EPAL sustentable', length: 120, width: 100, height: 150, maxWeight: 1250, type: 'pallet' },
  { id: 'daf_truck', name: 'DAF FT CF85', length: 597, width: 244, height: 283, maxWeight: 17400, type: 'truck' },
  { id: 'mercedes_actros', name: 'Mercedes-Benz Actros 1836', length: 581, width: 249.5, height: 302, maxWeight: 18000, type: 'truck' },
  { id: 'krone_liner', name: 'Krone Box Liner SDC 27', length: 1202, width: 235, height: 239.5, maxWeight: 26580, type: 'trailer' },
  { id: 'flat_plat_1', name: 'Plataforma de Carga 13m', length: 1360, width: 248, height: 450, maxWeight: 32000, type: 'platform' },
  { id: 'flat_plat_short', name: 'Plataforma Corta 6m', length: 600, width: 240, height: 450, maxWeight: 15000, type: 'platform' }
];
