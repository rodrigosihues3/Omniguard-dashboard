'use client';

import { useEffect, useState } from 'react';

type Coordenadas = { lat: number; lng: number };

function MapViewUpdater({
    useMapHook,
    target,
}: {
    useMapHook: () => { setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void; getZoom: () => number };
    target: Coordenadas;
}) {
    const map = useMapHook();
    useEffect(() => {
        map.setView([target.lat, target.lng], map.getZoom(), { animate: true });
    }, [map, target.lat, target.lng]);
    return null;
}

type LeafletBundle = {
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    useMapEvents: any;
    useMap: any;
};

export function MapPickerCanvas({
    tema,
    coords,
    onChange,
}: {
    tema: 'dark' | 'light';
    coords: Coordenadas;
    onChange: (coords: Coordenadas) => void;
}) {
    const [leafletBundle, setLeafletBundle] = useState<LeafletBundle | null>(null);

    useEffect(() => {
        const load = async () => {
            await import('leaflet/dist/leaflet.css');
            const L = (await import('leaflet')).default;
            const { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } = await import('react-leaflet');

            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            });

            setLeafletBundle({ MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap });
        };

        load();
    }, []);

    if (!leafletBundle) {
        return (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    backgroundColor: tema === 'light' ? '#EEF4FB' : '#242424',
                    color: tema === 'light' ? '#5F6B7A' : '#9DA8B8',
                }}
            >
                🗺️ Cargando mapa interactivo...
            </div>
        );
    }

    const { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } = leafletBundle;

    function ClickSelector() {
        useMapEvents({
            click: (event: any) => {
                onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
            },
        });
        return null;
    }

    return (
        <MapContainer
            center={[coords.lat, coords.lng]}
            zoom={15}
            style={{ height: '100%', width: '100%', borderRadius: '16px' }}
        >
            <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
            />
            <MapViewUpdater useMapHook={useMap} target={coords} />
            <ClickSelector />
            <Marker
                position={[coords.lat, coords.lng]}
                draggable
                eventHandlers={{
                    dragend: (event: any) => {
                        const marker = event.target;
                        const next = marker.getLatLng();
                        onChange({ lat: next.lat, lng: next.lng });
                    },
                }}
            >
                <Popup>
                    📍 Ubicación seleccionada<br />
                    Lat: {coords.lat.toFixed(6)}<br />
                    Lng: {coords.lng.toFixed(6)}
                </Popup>
            </Marker>
        </MapContainer>
    );
}