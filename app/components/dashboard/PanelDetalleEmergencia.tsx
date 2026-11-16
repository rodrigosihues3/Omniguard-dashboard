import React from 'react';
import MapaEmergencia from '../MapaEmergencia';
import { iconoTipo, colorEstado, colorEtiquetaIA } from '@/app/dashboard/dashboard.styles';

export default function PanelDetalleEmergencia({
    seleccionada,
    ui,
    tema,
    unidades = [],
    actualizando,
    despacharUnidad,
    reasignarUnidad,
    formatFecha,
    verTestigos
}: any) {
    const modoClaro = tema === 'light';
    const [verEvidencia, setVerEvidencia] = React.useState(false);
    const [errorImagen, setErrorImagen] = React.useState(false);
    const [unidadSeleccionadaId, setUnidadSeleccionadaId] = React.useState('');
    const [modalReasignarAbierto, setModalReasignarAbierto] = React.useState(false);
    const [nuevaUnidadId, setNuevaUnidadId] = React.useState('');
    const [motivoReasignacion, setMotivoReasignacion] = React.useState('');
    const [direccionResuelta, setDireccionResuelta] = React.useState<string>('');

    React.useEffect(() => {
        setUnidadSeleccionadaId('');
        setModalReasignarAbierto(false);
        setNuevaUnidadId('');
        setMotivoReasignacion('');
    }, [seleccionada?.id]);

    const coordenadasEmergencia = React.useMemo(() => {
        if (
            seleccionada?.latitud !== undefined &&
            seleccionada?.latitud !== null &&
            seleccionada?.longitud !== undefined &&
            seleccionada?.longitud !== null
        ) {
            const lat = Number(seleccionada.latitud);
            const lng = Number(seleccionada.longitud);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                return { lat, lng };
            }
        }
        if (typeof seleccionada?.ubicacion === 'string') {
            const match = seleccionada.ubicacion.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
            if (match) {
                const lng = Number.parseFloat(match[1]);
                const lat = Number.parseFloat(match[2]);
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                    return { lat, lng };
                }
            }
        }
        return null;
    }, [seleccionada?.latitud, seleccionada?.longitud, seleccionada?.ubicacion]);

    const direccionDirecta = React.useMemo(() => {
        const raw = (seleccionada?.direccion_aproximada || seleccionada?.direccion || '').trim();
        if (raw && raw !== 'No disponible') return raw;
        return '';
    }, [seleccionada?.direccion_aproximada, seleccionada?.direccion]);

    React.useEffect(() => {
        if (direccionDirecta) {
            setDireccionResuelta(direccionDirecta);
            return;
        }

        if (!coordenadasEmergencia) {
            setDireccionResuelta('No disponible');
            return;
        }

        const { lat, lng } = coordenadasEmergencia;
        const fallbackCoords = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        setDireccionResuelta(fallbackCoords);

        const controller = new AbortController();
        fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { signal: controller.signal }
        )
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!data) return;
                const addr = data.address || {};
                const calle = addr.road || addr.pedestrian || addr.residential || '';
                const distrito = addr.suburb || addr.city_district || addr.town || addr.city || '';
                const texto = [calle, distrito].filter(Boolean).join(', ') || data.display_name || '';
                if (texto) {
                    setDireccionResuelta(texto);
                }
            })
            .catch(() => {
                // Mantiene las coordenadas como respaldo si falla la consulta
            });

        return () => controller.abort();
    }, [seleccionada?.id, direccionDirecta, coordenadasEmergencia]);

    const unidadesDisponibles = React.useMemo(
        () => (unidades || []).filter((u: any) => u.estado === 'disponible'),
        [unidades]
    );

    const unidadesDisponiblesReasignacion = React.useMemo(
        () => (unidades || []).filter(
            (u: any) => u.estado === 'disponible' && u.id !== seleccionada?.unidad_asignada_id
        ),
        [unidades, seleccionada?.unidad_asignada_id]
    );

    const unidadAsignadaInfo = React.useMemo(() => {
        if (!seleccionada?.unidad_asignada_id) return null;
        if (seleccionada.unidades_bomberos) {
            return seleccionada.unidades_bomberos;
        }
        return (unidades || []).find((u: any) => u.id === seleccionada.unidad_asignada_id) || null;
    }, [seleccionada, unidades]);

    const badgeColor = colorEstado[seleccionada.estado] || '#FFC300';
    const esCerrada = seleccionada.estado === 'culminado' || seleccionada.estado === 'falsa_alarma';

    return (
        <div style={{ padding: '32px' }}>
            {/* HEADER con título y badge de estado */}
            <div style={{
                backgroundColor: ui.panel,
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                border: `1px solid ${ui.border}`,
                boxShadow: modoClaro ? '0 16px 40px rgba(16, 35, 61, 0.06)' : 'none',
            }}>
                <span style={{ fontSize: '40px' }}>{iconoTipo[seleccionada.tipo] || null}</span>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: ui.text }}>
                        {seleccionada.tipo}
                    </h1>
                    <p style={{ color: ui.mutedText, margin: '4px 0 0', fontSize: '12px' }}>
                        ID: {seleccionada.id.slice(0, 8)}...
                    </p>
                </div>

                {/* Badge estado */}
                <div style={{
                    padding: '8px 16px', borderRadius: '20px',
                    backgroundColor: badgeColor + '22',
                    color: badgeColor,
                    fontWeight: 'bold', fontSize: '14px',
                }}>
                    {seleccionada.estado.toUpperCase().replace('_', ' ')}
                </div>
            </div>

            {/* ── SECCIÓN DE DETALLE DE DOS COLUMNAS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-[16px] mb-[16px] items-stretch">
                <div className="flex flex-col gap-[16px]">
                    {/* Dirección */}
                    <div style={{ backgroundColor: ui.panel, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${ui.border}` }}>
                        <h3 style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, margin: '0 0 6px 0' }}>DIRECCIÓN APROXIMADA</h3>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: ui.text }}>{direccionResuelta || 'No disponible'}</div>
                        <div style={{ color: ui.mutedText, fontSize: '12px', marginTop: '4px' }}>{seleccionada.creado_en ? formatFecha(seleccionada.creado_en) : '-'}</div>
                    </div>

                    {/* Testigos */}
                    <div style={{ backgroundColor: ui.panel, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${ui.border}` }}>
                        <h3 style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, margin: '0 0 6px 0' }}>TESTIGOS</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#E63946', lineHeight: 1 }}>{seleccionada.testigos}</div>
                                <div style={{ color: ui.mutedText, fontSize: '12px', marginTop: '4px' }}>usuario(s) reportando</div>
                            </div>
                            <button
                                onClick={() => verTestigos(seleccionada)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#4361EE12',
                                    border: '1px solid #4361EE28', borderRadius: '8px', color: '#4361EE', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold'
                                }}
                            >
                                Ver
                            </button>
                        </div>
                    </div>

                    {/* Detalles IA */}
                    <div style={{
                        backgroundColor: ui.panel,
                        borderRadius: '16px',
                        padding: '14px 16px',
                        border: `1px solid ${ui.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, margin: '0 0 6px 0' }}>DETALLES</h3>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: ui.text }}>{seleccionada.usuarios?.nombres} {seleccionada.usuarios?.apellidos}</div>
                            <div style={{ fontSize: '12px', color: ui.mutedText, marginBottom: '8px' }}>DNI: {seleccionada.usuarios?.dni}</div>
                            {seleccionada.foto_url && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700,
                                    padding: '3px 8px', borderRadius: '12px', backgroundColor: colorEtiquetaIA[seleccionada.etiqueta_ia] + '18',
                                    color: colorEtiquetaIA[seleccionada.etiqueta_ia], textTransform: 'uppercase'
                                }}>
                                    {seleccionada.etiqueta_ia} ({seleccionada.nivel_confianza_ia}%)
                                </div>
                            )}
                        </div>
                        <div>
                            {seleccionada.foto_url ? (
                                <button
                                    onClick={() => {
                                        setErrorImagen(false);
                                        setVerEvidencia(true);
                                    }}
                                    style={{
                                        padding: '8px 14px',
                                        backgroundColor: '#4361EE12',
                                        border: '1px solid #4361EE28',
                                        borderRadius: '8px',
                                        color: '#4361EE',
                                        cursor: 'pointer',
                                        fontSize: '12.5px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Ver evidencia
                                </button>
                            ) : (
                                <button
                                    disabled
                                    style={{
                                        padding: '8px 14px',
                                        backgroundColor: ui.border,
                                        border: `1px solid ${ui.border}`,
                                        borderRadius: '8px',
                                        color: ui.mutedText,
                                        cursor: 'not-allowed',
                                        fontSize: '12.5px',
                                        fontWeight: 'bold',
                                        opacity: 0.6
                                    }}
                                >
                                    Sin evidencia
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Despacho de Unidad o Unidad Asignada */}
                    {['pendiente', 'asignado'].includes(seleccionada.estado) && !seleccionada.unidad_asignada_id && (
                        <div style={{
                            backgroundColor: ui.panel,
                            borderRadius: '16px',
                            padding: '16px',
                            border: `1px solid ${ui.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}>
                            <h3 style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, margin: 0 }}>
                                DESPACHO DE UNIDAD
                            </h3>
                            <select
                                value={unidadSeleccionadaId}
                                onChange={(e) => setUnidadSeleccionadaId(e.target.value)}
                                disabled={actualizando || unidadesDisponibles.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: `1px solid ${ui.border}`,
                                    backgroundColor: ui.surface,
                                    color: ui.text,
                                    fontSize: '13px',
                                    outline: 'none',
                                }}
                            >
                                <option value="">
                                    {unidadesDisponibles.length === 0
                                        ? 'Sin unidades disponibles'
                                        : 'Seleccionar unidad disponible'}
                                </option>
                                {unidadesDisponibles.map((unidad: any) => (
                                    <option key={unidad.id} value={unidad.id}>
                                        {unidad.codigo_unidad} - {unidad.tipo_unidad}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => despacharUnidad(seleccionada.id, unidadSeleccionadaId)}
                                disabled={!unidadSeleccionadaId || actualizando || unidadesDisponibles.length === 0}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: (!unidadSeleccionadaId || actualizando || unidadesDisponibles.length === 0)
                                        ? ui.border
                                        : '#4361EE',
                                    color: (!unidadSeleccionadaId || actualizando || unidadesDisponibles.length === 0)
                                        ? ui.mutedText
                                        : '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: (!unidadSeleccionadaId || actualizando || unidadesDisponibles.length === 0)
                                        ? 'not-allowed'
                                        : 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {actualizando ? 'Despachando...' : 'Despachar Unidad'}
                            </button>
                        </div>
                    )}

                    {seleccionada.unidad_asignada_id && (
                        <div style={{
                            backgroundColor: ui.panel,
                            borderRadius: '16px',
                            padding: '14px 16px',
                            border: `1px solid ${ui.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <div>
                                <h3 style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, margin: '0 0 6px 0' }}>
                                    UNIDAD DESPACHADA
                                </h3>
                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: ui.text }}>
                                    {unidadAsignadaInfo?.codigo_unidad || 'Unidad asignada'}
                                </div>
                                {unidadAsignadaInfo?.tipo_unidad && (
                                    <div style={{ color: ui.mutedText, fontSize: '12px', marginTop: '4px' }}>
                                        Tipo: {unidadAsignadaInfo.tipo_unidad}
                                    </div>
                                )}
                            </div>
                            {(seleccionada.estado === 'asignado' || seleccionada.estado === 'en_proceso') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNuevaUnidadId('');
                                        setMotivoReasignacion('');
                                        setModalReasignarAbierto(true);
                                    }}
                                    disabled={actualizando}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${ui.border}`,
                                        backgroundColor: ui.surface,
                                        color: ui.text,
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: actualizando ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Cambiar Unidad
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Mapa */}
                <div style={{ backgroundColor: ui.panel, borderRadius: '16px', padding: '20px', border: `1px solid ${ui.border}`, display: 'flex', flexDirection: 'column' }} className="h-[350px] lg:h-auto">
                    <h3 style={{ color: ui.mutedText, fontSize: '12px', margin: '0 0 12px' }}>UBICACIÓN DE LA EMERGENCIA</h3>
                    <div style={{ flex: 1, minHeight: '280px', borderRadius: '12px', overflow: 'hidden' }}>
                        <MapaEmergencia ubicacion={seleccionada.ubicacion} tema={tema} />
                    </div>
                </div>
            </div>

            {/* Acta de Cierre en Campo */}
            {esCerrada && (
                <div style={{
                    backgroundColor: ui.panel,
                    borderRadius: '16px',
                    padding: '20px',
                    border: `1px solid ${ui.border}`,
                    marginBottom: '16px',
                }}>
                    <h3 style={{ color: ui.mutedText, fontSize: '12px', fontWeight: 700, margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                        Acta de Cierre en Campo
                    </h3>
                    <div style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        backgroundColor: ui.surface,
                        border: `1px solid ${ui.border}`,
                        color: ui.text,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        marginBottom: seleccionada.foto_cierre_url ? '16px' : 0,
                    }}>
                        {seleccionada.informe_bombero || 'Sin informe registrado.'}
                    </div>
                    {seleccionada.foto_cierre_url && (
                        <div>
                            <div style={{ color: ui.mutedText, fontSize: '11px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                                Fotografía de cierre
                            </div>
                            <img
                                src={seleccionada.foto_cierre_url}
                                alt="Fotografía de cierre en campo"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '360px',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                    border: `1px solid ${ui.border}`,
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Modal Reasignar Unidad */}
            {modalReasignarAbierto && (
                <div
                    onClick={() => !actualizando && setModalReasignarAbierto(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '20px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '440px',
                            maxWidth: '95vw',
                            backgroundColor: ui.panel,
                            borderRadius: '12px',
                            border: `1px solid ${ui.border}`,
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: ui.text }}>
                                    Reasignar Unidad Despachada
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: ui.mutedText }}>
                                    Unidad actual: {unidadAsignadaInfo?.codigo_unidad || seleccionada.unidad_asignada_id}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={actualizando}
                                onClick={() => setModalReasignarAbierto(false)}
                                style={{
                                    background: 'transparent',
                                    border: `1px solid ${ui.border}`,
                                    borderRadius: '6px',
                                    color: ui.mutedText,
                                    width: '28px',
                                    height: '28px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                }}
                            >
                                X
                            </button>
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: ui.mutedText,
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                            }}>
                                Nueva Unidad Disponible
                            </label>
                            <select
                                value={nuevaUnidadId}
                                onChange={(e) => setNuevaUnidadId(e.target.value)}
                                disabled={actualizando || unidadesDisponiblesReasignacion.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${ui.border}`,
                                    backgroundColor: ui.surface,
                                    color: ui.text,
                                    fontSize: '13px',
                                    outline: 'none',
                                }}
                            >
                                <option value="">
                                    {unidadesDisponiblesReasignacion.length === 0
                                        ? 'No hay otras unidades disponibles'
                                        : 'Seleccionar nueva unidad'}
                                </option>
                                {unidadesDisponiblesReasignacion.map((unidad: any) => (
                                    <option key={unidad.id} value={unidad.id}>
                                        {unidad.codigo_unidad} - {unidad.tipo_unidad}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: ui.mutedText,
                                marginBottom: '6px',
                                textTransform: 'uppercase',
                            }}>
                                Motivo de Reasignación (obligatorio)
                            </label>
                            <textarea
                                rows={3}
                                value={motivoReasignacion}
                                onChange={(e) => setMotivoReasignacion(e.target.value)}
                                placeholder="Indique el motivo operativo del cambio de unidad (mínimo 5 caracteres)..."
                                disabled={actualizando}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${ui.border}`,
                                    backgroundColor: ui.surface,
                                    color: ui.text,
                                    fontSize: '13px',
                                    resize: 'vertical',
                                    outline: 'none',
                                }}
                            />
                            {motivoReasignacion.trim().length > 0 && motivoReasignacion.trim().length < 5 && (
                                <div style={{ fontSize: '11.5px', color: '#E63946', marginTop: '4px' }}>
                                    El motivo debe tener al menos 5 caracteres.
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                            <button
                                type="button"
                                disabled={actualizando}
                                onClick={() => setModalReasignarAbierto(false)}
                                style={{
                                    padding: '9px 16px',
                                    borderRadius: '8px',
                                    border: `1px solid ${ui.border}`,
                                    backgroundColor: 'transparent',
                                    color: ui.mutedText,
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={
                                    actualizando ||
                                    !nuevaUnidadId ||
                                    motivoReasignacion.trim().length < 5 ||
                                    unidadesDisponiblesReasignacion.length === 0
                                }
                                onClick={async () => {
                                    if (!reasignarUnidad) return;
                                    const ok = await reasignarUnidad(seleccionada, nuevaUnidadId, motivoReasignacion.trim());
                                    if (ok) {
                                        setModalReasignarAbierto(false);
                                    }
                                }}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: (
                                        actualizando ||
                                        !nuevaUnidadId ||
                                        motivoReasignacion.trim().length < 5 ||
                                        unidadesDisponiblesReasignacion.length === 0
                                    )
                                        ? ui.border
                                        : '#4361EE',
                                    color: (
                                        actualizando ||
                                        !nuevaUnidadId ||
                                        motivoReasignacion.trim().length < 5 ||
                                        unidadesDisponiblesReasignacion.length === 0
                                    )
                                        ? ui.mutedText
                                        : '#FFFFFF',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: (
                                        actualizando ||
                                        !nuevaUnidadId ||
                                        motivoReasignacion.trim().length < 5 ||
                                        unidadesDisponiblesReasignacion.length === 0
                                    )
                                        ? 'not-allowed'
                                        : 'pointer',
                                }}
                            >
                                {actualizando ? 'Reasignando...' : 'Confirmar Reasignación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lightbox Evidencia */}
            {verEvidencia && seleccionada.foto_url && (
                <div
                    onClick={() => setVerEvidencia(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        backdropFilter: 'blur(6px)',
                        padding: '24px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            backgroundColor: ui.panel,
                            borderRadius: '20px',
                            border: `1px solid ${ui.border}`,
                            padding: '20px',
                            maxWidth: '90vw',
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        }}
                    >
                        {/* Header del Lightbox */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px', gap: '20px' }}>
                            <div style={{ fontWeight: 'bold', color: ui.text, fontSize: '16px' }}>Evidencia de Emergencia</div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    onClick={() => setVerEvidencia(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: ui.text,
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        lineHeight: 1,
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Imagen o Error */}
                        {errorImagen ? (
                            <div style={{ padding: '40px 20px', color: '#E63946', textAlign: 'center', fontWeight: 'bold' }}>
                                Error al cargar la evidencia (URL expirada o rota)
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <img
                                    src={seleccionada.foto_url}
                                    alt="Evidencia"
                                    onError={() => setErrorImagen(true)}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '65vh',
                                        objectFit: 'contain',
                                        borderRadius: '12px',
                                    }}
                                />
                                {seleccionada.descripcion && (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '12px 16px',
                                        backgroundColor: modoClaro ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                                        borderRadius: '10px',
                                        color: ui.text,
                                        fontSize: '13.5px',
                                        lineHeight: '1.5',
                                        maxWidth: '100%',
                                        textAlign: 'center',
                                        borderLeft: '3px solid #4361EE',
                                        fontStyle: 'italic'
                                    }}>
                                        "{seleccionada.descripcion}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}