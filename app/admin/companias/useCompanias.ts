import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Compania } from '../admin.styles';

export interface ActualizarCompaniaPayload {
    direccion: string;
    telefono: string;
    unidades_totales: number;
    latitud: number;
    longitud: number;
}

export function useCompanias() {
    const [companias, setCompanias] = useState<Compania[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    const cargarCompanias = async () => {
        const [resCompanias, resCuentas] = await Promise.all([
            supabase
                .from('companias_bomberos')
                .select('*')
                .order('nombre'),
            supabase
                .from('usuarios_dashboard')
                .select('compania_id, email, rol, unidad_asignada_id')
                .not('compania_id', 'is', null),
        ]);

        if (!resCompanias.error && resCompanias.data) {
            const emailPorCompania = new Map<string, string>();
            (resCuentas.data || []).forEach((cuenta: {
                compania_id: string | null;
                email: string;
                rol: string;
                unidad_asignada_id: string | null;
            }) => {
                if (!cuenta.compania_id) return;
                const esCuentaPrincipal = cuenta.rol === 'compania' || cuenta.unidad_asignada_id === null;
                if (esCuentaPrincipal || !emailPorCompania.has(cuenta.compania_id)) {
                    emailPorCompania.set(cuenta.compania_id, cuenta.email);
                }
            });

            setCompanias(
                resCompanias.data.map((c: Compania) => ({
                    ...c,
                    email: emailPorCompania.get(c.id) || null,
                }))
            );
        }
        setIsLoading(false);
    };

    useEffect(() => {
        cargarCompanias();
    }, []);

    const actualizarCompania = async (id: string, payload: ActualizarCompaniaPayload): Promise<boolean> => {
        const companiaActual = companias.find(c => c.id === id);
        if (!companiaActual) return false;

        setGuardandoEdicion(true);
        try {
            const disponiblesAjustadas = Math.min(
                companiaActual.unidades_disponibles,
                payload.unidades_totales
            );

            const { error } = await supabase
                .from('companias_bomberos')
                .update({
                    direccion: payload.direccion,
                    telefono: payload.telefono,
                    unidades_totales: payload.unidades_totales,
                    unidades_disponibles: disponiblesAjustadas,
                    latitud: payload.latitud,
                    longitud: payload.longitud,
                })
                .eq('id', id);

            if (error) {
                toast.error('Error al actualizar la compañía');
                return false;
            }

            toast.success('Compañía y ubicación actualizadas correctamente');
            await cargarCompanias();
            return true;
        } finally {
            setGuardandoEdicion(false);
        }
    };

    const toggleActiva = async (id: string, activa: boolean) => {
        const { error } = await supabase
            .from('companias_bomberos')
            .update({ activa: !activa })
            .eq('id', id);

        if (error) {
            toast.error('Error al actualizar');
        } else {
            toast.success(activa ? 'Compañía desactivada' : 'Compañía activada');
            cargarCompanias();
        }
    };

    return {
        companias,
        isLoading,
        guardandoEdicion,
        actualizarCompania,
        toggleActiva,
        cargarCompanias,
    };
}