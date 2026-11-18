import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const LIMA_DEFAULT_COORDS = { lat: -12.0464, lng: -77.0428 };

type NuevaCompaniaForm = {
    nombre: string;
    direccion: string;
    telefono: string;
    email: string;
    password: string;
    latitud: string;
    longitud: string;
    unidadesTotales: string;
    activa: boolean;
};

type Coordenadas = { lat: number; lng: number };
type FormErrors = Partial<Record<keyof NuevaCompaniaForm, string>>;

const DEFAULT_FORM: NuevaCompaniaForm = {
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    password: '',
    latitud: '',
    longitud: '',
    unidadesTotales: '1',
    activa: true,
};

const sanitizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const sanitizePhone = (value: string) => value.replace(/\D/g, '');

const sanitizeCoordinateInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const withoutExtraMinus = cleaned.replace(/(?!^)-/g, '').replace(/^--+/, '-');
    const [integerPart = '', ...decimalParts] = withoutExtraMinus.split('.');
    if (decimalParts.length === 0) return withoutExtraMinus;
    return `${integerPart}.${decimalParts.join('')}`;
};

export function useNuevaCompania() {
    const [isSavingCompania, setIsSavingCompania] = useState(false);
    const [nuevaCompania, setNuevaCompania] = useState<NuevaCompaniaForm>(DEFAULT_FORM);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState<string | null>(null);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [mapDraftCoords, setMapDraftCoords] = useState<Coordenadas | null>(null);
    const [busquedaDireccion, setBusquedaDireccion] = useState('');
    const [buscandoDireccion, setBuscandoDireccion] = useState(false);
    const pinMovidoManualmenteRef = useRef(false);
    const router = useRouter();

    const abrirMapPicker = () => {
        pinMovidoManualmenteRef.current = false;
        const lat = Number.parseFloat(nuevaCompania.latitud);
        const lng = Number.parseFloat(nuevaCompania.longitud);
        const tieneCoordsPrevias = !Number.isNaN(lat) && !Number.isNaN(lng);

        if (tieneCoordsPrevias) {
            setMapDraftCoords({ lat, lng });
        } else {
            setMapDraftCoords(LIMA_DEFAULT_COORDS);
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (!pinMovidoManualmenteRef.current) {
                            setMapDraftCoords({
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                            });
                        }
                    },
                    () => {
                        // Si se niega el permiso o falla, se mantiene Lima por defecto
                    },
                    { enableHighAccuracy: true, timeout: 6000 }
                );
            }
        }
        setBusquedaDireccion(nuevaCompania.direccion.trim());
        setIsMapPickerOpen(true);
    };

    const cerrarMapPicker = () => setIsMapPickerOpen(false);

    const seleccionarCoordenadasEnMapa = (coords: Coordenadas) => {
        pinMovidoManualmenteRef.current = true;
        setMapDraftCoords(coords);
    };

    const buscarDireccionEnMapa = async () => {
        const query = busquedaDireccion.trim();
        if (!query) {
            toast.error('Ingresa una dirección para buscar');
            return;
        }

        setBuscandoDireccion(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(query)}`;
            const resp = await fetch(url, {
                headers: { 'Accept-Language': 'es' },
            });
            if (!resp.ok) throw new Error('Error al consultar el buscador');
            const results = await resp.json();

            if (!Array.isArray(results) || results.length === 0) {
                toast.error('No se encontró esa dirección en el mapa');
                return;
            }

            const lat = Number.parseFloat(results[0].lat);
            const lng = Number.parseFloat(results[0].lon);
            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                toast.error('No se pudieron obtener las coordenadas');
                return;
            }

            pinMovidoManualmenteRef.current = true;
            setMapDraftCoords({ lat, lng });
        } catch (error) {
            console.error('Error buscando dirección:', error);
            toast.error('No se pudo buscar la dirección');
        } finally {
            setBuscandoDireccion(false);
        }
    };

    const confirmarCoordenadasMapa = () => {
        if (!mapDraftCoords) {
            toast.error('Selecciona una ubicación en el mapa');
            return;
        }

        setNuevaCompania((actual) => ({
            ...actual,
            latitud: mapDraftCoords.lat.toFixed(6),
            longitud: mapDraftCoords.lng.toFixed(6),
        }));

        setFormErrors((actual) => {
            const siguiente = { ...actual };
            delete siguiente.latitud;
            delete siguiente.longitud;
            return siguiente;
        });

        setIsMapPickerOpen(false);
    };

    const actualizarCampoCompania = (campo: keyof NuevaCompaniaForm, valor: string | boolean) => {
        setNuevaCompania((actual) => ({
            ...actual,
            [campo]:
                campo === 'telefono' && typeof valor === 'string'
                    ? valor.replace(/\D/g, '').slice(0, 9)
                    : (campo === 'latitud' || campo === 'longitud') && typeof valor === 'string'
                        ? sanitizeCoordinateInput(valor)
                        : typeof valor === 'string'
                            ? valor
                            : valor,
        }));

        setFormErrors((actual) => {
            if (!actual[campo]) return actual;
            const siguiente = { ...actual };
            delete siguiente[campo];
            return siguiente;
        });
    };

    const validarNuevaCompania = () => {
        const errores: FormErrors = {};
        const nombre = sanitizeText(nuevaCompania.nombre);
        const direccion = sanitizeText(nuevaCompania.direccion);
        const telefono = sanitizePhone(nuevaCompania.telefono);
        const email = nuevaCompania.email.trim().toLowerCase();
        const password = nuevaCompania.password.trim() || 'bomberos123';
        const latitud = sanitizeCoordinateInput(nuevaCompania.latitud);
        const longitud = sanitizeCoordinateInput(nuevaCompania.longitud);
        const unidadesTotales = Number.parseInt(nuevaCompania.unidadesTotales, 10);
        const latitudNum = Number.parseFloat(latitud);
        const longitudNum = Number.parseFloat(longitud);

        if (!nombre) errores.nombre = 'El nombre es obligatorio';
        if (!direccion) errores.direccion = 'La dirección es obligatoria';
        if (!telefono) errores.telefono = 'El teléfono es obligatorio';
        else if (telefono.length !== 9) errores.telefono = 'El teléfono debe tener 9 dígitos';
        if (!email) errores.email = 'El correo es obligatorio';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errores.email = 'Ingresa un correo electrónico válido';
        }
        if (!latitud) errores.latitud = 'La latitud es obligatoria';
        else if (Number.isNaN(latitudNum) || latitudNum < -90 || latitudNum > 90) {
            errores.latitud = 'La latitud debe estar entre -90 y 90';
        }
        if (!longitud) errores.longitud = 'La longitud es obligatoria';
        else if (Number.isNaN(longitudNum) || longitudNum < -180 || longitudNum > 180) {
            errores.longitud = 'La longitud debe estar entre -180 y 180';
        }
        if (!nuevaCompania.unidadesTotales.trim()) {
            errores.unidadesTotales = 'Las unidades totales son obligatorias';
        } else if (Number.isNaN(unidadesTotales) || unidadesTotales < 0) {
            errores.unidadesTotales = 'Ingresa un número válido mayor o igual a 0';
        }

        return {
            errores,
            payload: {
                nombre,
                direccion,
                telefono,
                email,
                password,
                latitud: latitudNum,
                longitud: longitudNum,
                unidadesTotales,
            },
        };
    };

    const guardarNuevaCompania = async () => {
        const { errores, payload } = validarNuevaCompania();

        if (Object.keys(errores).length > 0) {
            setFormErrors(errores);
            toast.error('Revisa los campos de la compañía');
            return;
        }

        setIsSavingCompania(true);
        setServerError(null);

        try {
            const unidadesDisponibles = nuevaCompania.activa ? payload.unidadesTotales : 0;

            const insertPayload = {
                nombre: payload.nombre,
                direccion: payload.direccion,
                telefono: payload.telefono,
                email: payload.email,
                password: payload.password,
                latitud: payload.latitud,
                longitud: payload.longitud,
                unidades_totales: payload.unidadesTotales,
                unidades_disponibles: unidadesDisponibles,
                activa: nuevaCompania.activa,
            };

            const resp = await fetch('/api/companias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(insertPayload),
            });

            const json = await resp.json();

            if (!resp.ok) {
                const msg = json?.error || `Server returned ${resp.status}`;
                setServerError(msg);
                toast.error(msg);
                return;
            }

            toast.success('Compañía registrada correctamente');
            setNuevaCompania(DEFAULT_FORM);
            setFormErrors({});
            router.push('/admin/companias');
        } catch (error) {
            console.error('Error al crear compañía:', error);
            const err = error as { message?: string } | null;
            const message = err?.message || 'No se pudo registrar la compañía';
            setServerError(message);
            toast.error(message);
        } finally {
            setIsSavingCompania(false);
        }
    };

    return {
        isSavingCompania,
        nuevaCompania,
        formErrors,
        serverError,
        isMapPickerOpen,
        mapDraftCoords,
        busquedaDireccion,
        setBusquedaDireccion,
        buscandoDireccion,
        actualizarCampoCompania,
        abrirMapPicker,
        cerrarMapPicker,
        seleccionarCoordenadasEnMapa,
        buscarDireccionEnMapa,
        confirmarCoordenadasMapa,
        guardarNuevaCompania,
    };
}