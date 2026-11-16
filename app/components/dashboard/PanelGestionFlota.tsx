'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface UnidadBombero {
  id: string;
  codigo_unidad: string;
  tipo_unidad: string;
  estado: string;
  activa: boolean;
  capacidad_maxima: number | null;
}

interface CuentaOperativa {
  id: string;
  email: string;
  placa_servicio: string | null;
  password_hash: string;
  nombre: string;
  rol: string;
  unidad_asignada_id: string | null;
  activo: boolean;
}

interface PanelGestionFlotaProps {
  companiaId: string;
  companiaNombre?: string;
  ui: Record<string, string>;
  tema: 'dark' | 'light';
  onFlotaActualizada?: () => Promise<void> | void;
}

const CATALOGO_UNIDADES_CGBVP = [
  {
    prefijo: 'M',
    tipo: 'Autobomba',
    funcion: 'Extinción de incendios urbanos, estructurales y control de fugas iniciales.',
  },
  {
    prefijo: 'AMB',
    tipo: 'Ambulancia',
    funcion: 'Atención prehospitalaria de emergencia, soporte vital y traslado de heridos.',
  },
  {
    prefijo: 'RES',
    tipo: 'Unidad de Rescate',
    funcion: 'Extricación vehicular, rescate en altura, estructuras colapsadas y espacios confinados.',
  },
  {
    prefijo: 'ESC',
    tipo: 'Escala Telescópica',
    funcion: 'Combate de incendios y evacuación en edificios de gran altura.',
  },
  {
    prefijo: 'AUX',
    tipo: 'Auxiliar / Cisterna',
    funcion: 'Abastecimiento continuo de agua y soporte logístico en siniestros de gran magnitud.',
  },
] as const;

type CatalogoItem = (typeof CATALOGO_UNIDADES_CGBVP)[number];

function extraerNumeroCompania(nombreEstacion?: string): string {
  if (!nombreEstacion) return '1';
  const match = nombreEstacion.match(/(\d+)(?!.*\d)/);
  return match ? match[1] : '1';
}

function esMandoSuperior(nombre: string): boolean {
  const limpio = (nombre || '').trim().toLowerCase();
  return limpio.startsWith('tnte.') || limpio.startsWith('cap.');
}

function ordenarDotacion(cuentas: CuentaOperativa[]): CuentaOperativa[] {
  return [...cuentas].sort((a, b) => {
    const aMando = esMandoSuperior(a.nombre);
    const bMando = esMandoSuperior(b.nombre);
    if (aMando !== bMando) return aMando ? -1 : 1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
  });
}

export default function PanelGestionFlota({
  companiaId,
  companiaNombre = '',
  ui,
  tema,
  onFlotaActualizada,
}: PanelGestionFlotaProps) {
  const modoClaro = tema === 'light';

  const [unidades, setUnidades] = useState<UnidadBombero[]>([]);
  const [cuentas, setCuentas] = useState<CuentaOperativa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Controles Sección Dotación
  const [filtroUnidadId, setFiltroUnidadId] = useState<string>('todas');
  const [vistaDotacion, setVistaDotacion] = useState<'cards' | 'lista'>('cards');

  // Modal + Nueva Unidad
  const [modalUnidadAbierto, setModalUnidadAbierto] = useState(false);
  const [prefijoSeleccionado, setPrefijoSeleccionado] = useState<string>(CATALOGO_UNIDADES_CGBVP[0].prefijo);
  const [codigoUnidad, setCodigoUnidad] = useState('');
  const [capacidadMaxima, setCapacidadMaxima] = useState<number>(4);
  const [mostrarInfoTipo, setMostrarInfoTipo] = useState(false);

  // Modal + Nueva Cuenta
  const [modalCuentaAbierto, setModalCuentaAbierto] = useState(false);
  const [cuentaUnidadId, setCuentaUnidadId] = useState('');
  const [cuentaNombre, setCuentaNombre] = useState('');
  const [cuentaPlaca, setCuentaPlaca] = useState('');
  const [cuentaEmail, setCuentaEmail] = useState('');
  const [cuentaPassword, setCuentaPassword] = useState('');

  // Modal Editar Cuenta
  const [cuentaEditando, setCuentaEditando] = useState<CuentaOperativa | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPlaca, setEditPlaca] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editActivo, setEditActivo] = useState(true);

  const cargarFlota = useCallback(async () => {
    if (!companiaId) return;
    setCargando(true);
    try {
      const [resUnidades, resCuentas] = await Promise.all([
        supabase
          .from('unidades_bomberos')
          .select('id, codigo_unidad, tipo_unidad, estado, activa, capacidad_maxima')
          .eq('compania_id', companiaId)
          .order('codigo_unidad', { ascending: true }),
        supabase
          .from('usuarios_dashboard')
          .select('id, email, placa_servicio, password_hash, nombre, rol, unidad_asignada_id, activo')
          .eq('compania_id', companiaId),
      ]);

      if (resUnidades.error) throw resUnidades.error;
      if (resCuentas.error) throw resCuentas.error;

      setUnidades((resUnidades.data || []) as UnidadBombero[]);
      setCuentas((resCuentas.data || []) as CuentaOperativa[]);
    } catch (error) {
      console.error('Error al cargar flota:', error);
      toast.error('No se pudo cargar la flota y dotación');
    } finally {
      setCargando(false);
    }
  }, [companiaId]);

  useEffect(() => {
    cargarFlota();
  }, [cargarFlota]);

  const sincronizarContadoresCompania = useCallback(async () => {
    const { data, error } = await supabase
      .from('unidades_bomberos')
      .select('id, estado, activa')
      .eq('compania_id', companiaId);

    if (error || !data) return;

    const unidadesActivas = data.filter((u) => u.activa === true);
    const totalActivas = unidadesActivas.length;
    const totalDisponibles = unidadesActivas.filter((u) => u.estado === 'disponible').length;

    await supabase
      .from('companias_bomberos')
      .update({
        unidades_totales: totalActivas,
        unidades_disponibles: totalDisponibles,
      })
      .eq('id', companiaId);
  }, [companiaId]);

  const calcularCodigoSugerido = useCallback(
    (prefijo: string) => {
      const numeroCia = extraerNumeroCompania(companiaNombre);
      const base = `${prefijo}-${numeroCia}-`;
      const baseLower = base.toLowerCase();
      const usados = new Set<number>();

      unidades.forEach((u) => {
        const codigo = (u.codigo_unidad || '').trim();
        if (codigo.toLowerCase().startsWith(baseLower)) {
          const sufijo = codigo.slice(base.length);
          const n = parseInt(sufijo, 10);
          if (!Number.isNaN(n) && n > 0) {
            usados.add(n);
          }
        }
      });

      let correlativo = 1;
      while (usados.has(correlativo)) {
        correlativo += 1;
      }
      return `${base}${correlativo}`;
    },
    [companiaNombre, unidades]
  );

  const abrirModalNuevaUnidad = () => {
    const prefijoInicial = CATALOGO_UNIDADES_CGBVP[0].prefijo;
    setPrefijoSeleccionado(prefijoInicial);
    setCodigoUnidad(calcularCodigoSugerido(prefijoInicial));
    setCapacidadMaxima(4);
    setMostrarInfoTipo(false);
    setModalUnidadAbierto(true);
  };

  const handleCambioTipoUnidad = (nuevoPrefijo: string) => {
    setPrefijoSeleccionado(nuevoPrefijo);
    setCodigoUnidad(calcularCodigoSugerido(nuevoPrefijo));
  };

  const catalogoSeleccionado: CatalogoItem = useMemo(
    () =>
      CATALOGO_UNIDADES_CGBVP.find((item) => item.prefijo === prefijoSeleccionado) ||
      CATALOGO_UNIDADES_CGBVP[0],
    [prefijoSeleccionado]
  );

  const cuentasPorUnidad = useMemo(() => {
    const mapa: Record<string, CuentaOperativa[]> = {};
    cuentas.forEach((c) => {
      if (!c.unidad_asignada_id) return;
      if (!mapa[c.unidad_asignada_id]) {
        mapa[c.unidad_asignada_id] = [];
      }
      mapa[c.unidad_asignada_id].push(c);
    });
    Object.keys(mapa).forEach((unidadId) => {
      mapa[unidadId] = ordenarDotacion(mapa[unidadId]);
    });
    return mapa;
  }, [cuentas]);

  const unidadesFiltradasDotacion = useMemo(() => {
    if (filtroUnidadId === 'todas') return unidades;
    return unidades.filter((u) => u.id === filtroUnidadId);
  }, [unidades, filtroUnidadId]);

  const filasListaDotacion = useMemo(() => {
    const filas: Array<{ unidad: UnidadBombero; cuenta: CuentaOperativa }> = [];
    unidadesFiltradasDotacion.forEach((unidad) => {
      const lista = cuentasPorUnidad[unidad.id] || [];
      lista.forEach((cuenta) => {
        filas.push({ unidad, cuenta });
      });
    });
    return filas;
  }, [unidadesFiltradasDotacion, cuentasPorUnidad]);

  const handleCrearUnidad = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoLimpio = codigoUnidad.trim();
    if (!codigoLimpio) {
      toast.error('Ingrese el código de unidad');
      return;
    }

    const cupo = Math.min(12, Math.max(1, Number(capacidadMaxima) || 4));
    setProcesando(true);
    try {
      const { error } = await supabase.from('unidades_bomberos').insert({
        compania_id: companiaId,
        codigo_unidad: codigoLimpio,
        tipo_unidad: catalogoSeleccionado.tipo,
        estado: 'disponible',
        activa: true,
        capacidad_maxima: cupo,
      });

      if (error) throw error;

      await sincronizarContadoresCompania();
      await cargarFlota();
      if (onFlotaActualizada) await onFlotaActualizada();

      setModalUnidadAbierto(false);
      toast.success(`Unidad ${codigoLimpio} registrada`);
    } catch (error) {
      console.error('Error al registrar unidad:', error);
      toast.error('No se pudo registrar la unidad');
    } finally {
      setProcesando(false);
    }
  };

  const handleToggleEstadoUnidad = async (unidad: UnidadBombero) => {
    setProcesando(true);
    try {
      const nuevoEstadoActiva = !unidad.activa;
      const { error } = await supabase
        .from('unidades_bomberos')
        .update({ activa: nuevoEstadoActiva })
        .eq('id', unidad.id);

      if (error) throw error;

      await sincronizarContadoresCompania();
      await cargarFlota();
      if (onFlotaActualizada) await onFlotaActualizada();

      toast.success(
        nuevoEstadoActiva
          ? `Unidad ${unidad.codigo_unidad} activada`
          : `Unidad ${unidad.codigo_unidad} desactivada`
      );
    } catch (error) {
      console.error('Error al cambiar estado de unidad:', error);
      toast.error('No se pudo actualizar el estado de la unidad');
    } finally {
      setProcesando(false);
    }
  };

  const abrirModalNuevaCuenta = () => {
    const unidadesActivas = unidades.filter((u) => u.activa);
    const primeraDisponible = unidadesActivas.find((u) => {
      const ocupados = (cuentasPorUnidad[u.id] || []).length;
      const cap = u.capacidad_maxima ?? 4;
      return ocupados < cap;
    });
    setCuentaUnidadId(primeraDisponible?.id || '');
    setCuentaNombre('');
    setCuentaPlaca('');
    setCuentaEmail('');
    setCuentaPassword('');
    setModalCuentaAbierto(true);
  };

  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !cuentaUnidadId ||
      !cuentaNombre.trim() ||
      !cuentaPlaca.trim() ||
      !cuentaEmail.trim() ||
      !cuentaPassword.trim()
    ) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }

    const unidadObj = unidades.find((u) => u.id === cuentaUnidadId);
    const ocupados = (cuentasPorUnidad[cuentaUnidadId] || []).length;
    const cap = unidadObj?.capacidad_maxima ?? 4;
    if (ocupados >= cap) {
      toast.error('La unidad seleccionada alcanzó su cupo máximo');
      return;
    }

    setProcesando(true);
    try {
      const { error } = await supabase.from('usuarios_dashboard').insert({
        rol: 'bombero',
        compania_id: companiaId,
        unidad_asignada_id: cuentaUnidadId,
        nombre: cuentaNombre.trim(),
        placa_servicio: cuentaPlaca.trim(),
        email: cuentaEmail.trim(),
        password_hash: cuentaPassword.trim(),
        activo: true,
      });

      if (error) throw error;

      await cargarFlota();
      if (onFlotaActualizada) await onFlotaActualizada();

      setModalCuentaAbierto(false);
      toast.success('Cuenta operativa registrada');
    } catch (error) {
      console.error('Error al crear cuenta operativa:', error);
      toast.error('No se pudo registrar la cuenta operativa');
    } finally {
      setProcesando(false);
    }
  };

  const abrirModalEditarCuenta = (cuenta: CuentaOperativa) => {
    setCuentaEditando(cuenta);
    setEditNombre(cuenta.nombre || '');
    setEditPlaca(cuenta.placa_servicio || '');
    setEditEmail(cuenta.email || '');
    setEditPassword(cuenta.password_hash || '');
    setEditActivo(cuenta.activo);
  };

  const handleGuardarEdicionCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaEditando) return;
    if (!editNombre.trim() || !editPlaca.trim() || !editEmail.trim() || !editPassword.trim()) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }

    setProcesando(true);
    try {
      const { error } = await supabase
        .from('usuarios_dashboard')
        .update({
          nombre: editNombre.trim(),
          placa_servicio: editPlaca.trim(),
          email: editEmail.trim(),
          password_hash: editPassword.trim(),
          activo: editActivo,
        })
        .eq('id', cuentaEditando.id);

      if (error) throw error;

      await cargarFlota();
      if (onFlotaActualizada) await onFlotaActualizada();
      setCuentaEditando(null);
      toast.success('Cuenta actualizada');
    } catch (error) {
      console.error('Error al actualizar cuenta:', error);
      toast.error('No se pudo actualizar la cuenta');
    } finally {
      setProcesando(false);
    }
  };

  const handleToggleEstadoCuenta = async (cuenta: CuentaOperativa) => {
    setProcesando(true);
    try {
      const nuevoActivo = !cuenta.activo;
      const { error } = await supabase
        .from('usuarios_dashboard')
        .update({ activo: nuevoActivo })
        .eq('id', cuenta.id);

      if (error) throw error;

      await cargarFlota();
      if (onFlotaActualizada) await onFlotaActualizada();
      toast.success(nuevoActivo ? 'Cuenta activada' : 'Cuenta desactivada');
    } catch (error) {
      console.error('Error al cambiar estado de cuenta:', error);
      toast.error('No se pudo actualizar el estado de la cuenta');
    } finally {
      setProcesando(false);
    }
  };

  const badgeEstadoUnidad = (estado: string, activa: boolean) => {
    if (!activa) {
      return { label: 'INACTIVA', color: '#64748B', bg: 'rgba(100, 116, 139, 0.14)' };
    }
    if (estado === 'disponible') {
      return { label: 'DISPONIBLE', color: '#2DC653', bg: 'rgba(45, 198, 83, 0.14)' };
    }
    if (estado === 'en_servicio') {
      return { label: 'EN SERVICIO', color: '#4361EE', bg: 'rgba(67, 97, 238, 0.14)' };
    }
    return { label: estado.toUpperCase().replace('_', ' '), color: '#B45309', bg: 'rgba(245, 158, 11, 0.14)' };
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: `1px solid ${ui.border}`,
    backgroundColor: ui.surface,
    color: ui.text,
    fontSize: '13px',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: ui.mutedText,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* SECCIÓN SUPERIOR: GESTIÓN DE UNIDADES (FLOTA) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: ui.text }}>
            Flota de Unidades
          </h2>
          <button
            type="button"
            onClick={abrirModalNuevaUnidad}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4361EE',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Nueva Unidad
          </button>
        </div>

        <div style={{
          backgroundColor: ui.panel,
          borderRadius: '12px',
          border: `1px solid ${ui.border}`,
          overflowX: 'auto',
        }}>
          {cargando ? (
            <div style={{ padding: '24px', textAlign: 'center', color: ui.mutedText, fontSize: '13px' }}>
              Cargando flota...
            </div>
          ) : unidades.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: ui.mutedText, fontSize: '13px' }}>
              No hay unidades registradas en esta compañía.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: ui.surface }}>
                  {['CÓDIGO', 'TIPO DE UNIDAD', 'CUPO', 'ESTADO', 'ACCIÓN'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: ui.mutedText,
                        borderBottom: `1px solid ${ui.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unidades.map((unidad) => {
                  const badge = badgeEstadoUnidad(unidad.estado, unidad.activa);
                  const ocupados = (cuentasPorUnidad[unidad.id] || []).length;
                  const capacidad = unidad.capacidad_maxima ?? 4;
                  return (
                    <tr
                      key={unidad.id}
                      style={{
                        borderBottom: `1px solid ${ui.border}`,
                        opacity: unidad.activa ? 1 : 0.65,
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: ui.text }}>
                        {unidad.codigo_unidad}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: ui.text }}>
                        {unidad.tipo_unidad}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: ui.mutedText }}>
                        {ocupados} / {capacidad}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          type="button"
                          disabled={procesando}
                          onClick={() => handleToggleEstadoUnidad(unidad)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${unidad.activa ? 'rgba(230, 57, 70, 0.28)' : 'rgba(45, 198, 83, 0.28)'}`,
                            backgroundColor: unidad.activa ? 'rgba(230, 57, 70, 0.08)' : 'rgba(45, 198, 83, 0.08)',
                            color: unidad.activa ? '#E63946' : '#2DC653',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: procesando ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {unidad.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* SECCIÓN INFERIOR: DOTACIÓN AGRUPADA POR UNIDAD */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: ui.text }}>
            Dotación por Unidad
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={filtroUnidadId}
              onChange={(e) => setFiltroUnidadId(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${ui.border}`,
                backgroundColor: ui.panel,
                color: ui.text,
                fontSize: '12.5px',
                outline: 'none',
              }}
            >
              <option value="todas">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo_unidad} - {u.tipo_unidad}
                </option>
              ))}
            </select>

            <div style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              border: `1px solid ${ui.border}`,
              backgroundColor: ui.surface,
              gap: '2px',
            }}>
              <button
                type="button"
                onClick={() => setVistaDotacion('cards')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: vistaDotacion === 'cards' ? ui.panel : 'transparent',
                  color: vistaDotacion === 'cards' ? ui.text : ui.mutedText,
                  boxShadow: vistaDotacion === 'cards' && modoClaro ? '0 1px 2px rgba(16, 35, 61, 0.08)' : 'none',
                }}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setVistaDotacion('lista')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: vistaDotacion === 'lista' ? ui.panel : 'transparent',
                  color: vistaDotacion === 'lista' ? ui.text : ui.mutedText,
                  boxShadow: vistaDotacion === 'lista' && modoClaro ? '0 1px 2px rgba(16, 35, 61, 0.08)' : 'none',
                }}
              >
                Lista
              </button>
            </div>

            <button
              type="button"
              onClick={abrirModalNuevaCuenta}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#4361EE',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Nueva Cuenta
            </button>
          </div>
        </div>

        {cargando ? (
          <div style={{
            backgroundColor: ui.panel,
            borderRadius: '12px',
            border: `1px solid ${ui.border}`,
            padding: '32px',
            textAlign: 'center',
            color: ui.mutedText,
            fontSize: '13px',
          }}>
            Cargando dotación...
          </div>
        ) : unidadesFiltradasDotacion.length === 0 ? (
          <div style={{
            backgroundColor: ui.panel,
            borderRadius: '12px',
            border: `1px solid ${ui.border}`,
            padding: '32px',
            textAlign: 'center',
            color: ui.mutedText,
            fontSize: '13px',
          }}>
            No existen unidades para mostrar.
          </div>
        ) : vistaDotacion === 'cards' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {unidadesFiltradasDotacion.map((unidad) => {
              const dotacion = cuentasPorUnidad[unidad.id] || [];
              const capacidad = unidad.capacidad_maxima ?? 4;
              const badge = badgeEstadoUnidad(unidad.estado, unidad.activa);

              return (
                <div
                  key={unidad.id}
                  style={{
                    backgroundColor: ui.panel,
                    borderRadius: '12px',
                    border: `1px solid ${ui.border}`,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Cabecera del Card general */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    paddingBottom: '10px',
                    borderBottom: `1px solid ${ui.border}`,
                  }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: ui.text }}>
                      {unidad.codigo_unidad} · {unidad.tipo_unidad}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: ui.surface,
                        border: `1px solid ${ui.border}`,
                        color: ui.text,
                      }}>
                        {dotacion.length} / {capacidad}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo del Card general: 4 columnas */}
                  {dotacion.length === 0 ? (
                    <div style={{ fontSize: '12.5px', color: ui.mutedText, padding: '8px 0' }}>
                      Sin efectivos asignados a esta unidad.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {dotacion.map((cuenta) => (
                        <div
                          key={cuenta.id}
                          style={{
                            backgroundColor: ui.surface,
                            border: `1px solid ${ui.border}`,
                            borderRadius: '10px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            minWidth: 0,
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '6px',
                          }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: ui.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }} title={cuenta.nombre}>
                              {cuenta.nombre}
                            </div>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: cuenta.activo ? 'rgba(45, 198, 83, 0.14)' : 'rgba(100, 116, 139, 0.14)',
                              color: cuenta.activo ? '#2DC653' : '#64748B',
                              flexShrink: 0,
                            }}>
                              {cuenta.activo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: ui.mutedText }}>
                            Placa: {cuenta.placa_servicio || '-'}
                          </div>

                          <div
                            className="truncate"
                            title={cuenta.email}
                            style={{ fontSize: '12px', color: ui.mutedText }}
                          >
                            {cuenta.email}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button
                              type="button"
                              disabled={procesando}
                              onClick={() => abrirModalEditarCuenta(cuenta)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: `1px solid ${ui.border}`,
                                backgroundColor: ui.panel,
                                color: ui.text,
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: procesando ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={procesando}
                              onClick={() => handleToggleEstadoCuenta(cuenta)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: `1px solid ${cuenta.activo ? 'rgba(230, 57, 70, 0.28)' : 'rgba(45, 198, 83, 0.28)'}`,
                                backgroundColor: cuenta.activo ? 'rgba(230, 57, 70, 0.08)' : 'rgba(45, 198, 83, 0.08)',
                                color: cuenta.activo ? '#E63946' : '#2DC653',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: procesando ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {cuenta.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            backgroundColor: ui.panel,
            borderRadius: '12px',
            border: `1px solid ${ui.border}`,
            overflowX: 'auto',
          }}>
            {filasListaDotacion.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: ui.mutedText, fontSize: '13px' }}>
                Sin efectivos registrados para el filtro seleccionado.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: ui.surface }}>
                    {['UNIDAD', 'NOMBRE', 'PLACA', 'CORREO', 'ESTADO', 'ACCIONES'].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: ui.mutedText,
                          borderBottom: `1px solid ${ui.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasListaDotacion.map(({ unidad, cuenta }) => (
                    <tr key={cuenta.id} style={{ borderBottom: `1px solid ${ui.border}` }}>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 700, color: ui.text, whiteSpace: 'nowrap' }}>
                        {unidad.codigo_unidad}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: ui.text }}>
                        {cuenta.nombre}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: ui.mutedText }}>
                        {cuenta.placa_servicio || '-'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12.5px', color: ui.mutedText, maxWidth: '220px' }}>
                        <div className="truncate" title={cuenta.email}>
                          {cuenta.email}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '6px',
                          backgroundColor: cuenta.activo ? 'rgba(45, 198, 83, 0.14)' : 'rgba(100, 116, 139, 0.14)',
                          color: cuenta.activo ? '#2DC653' : '#64748B',
                        }}>
                          {cuenta.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          type="button"
                          onClick={() => abrirModalEditarCuenta(cuenta)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${ui.border}`,
                            backgroundColor: ui.surface,
                            color: ui.text,
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* MODAL: + NUEVA UNIDAD */}
      {modalUnidadAbierto && (
        <div
          onClick={() => !procesando && setModalUnidadAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCrearUnidad}
            style={{
              width: '460px',
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
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: ui.text }}>
                Nueva Unidad
              </h2>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setModalUnidadAbierto(false)}
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
              <label style={labelStyle}>Tipo de Unidad</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={prefijoSeleccionado}
                  onChange={(e) => handleCambioTipoUnidad(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {CATALOGO_UNIDADES_CGBVP.map((item) => (
                    <option key={item.prefijo} value={item.prefijo}>
                      {item.tipo} ({item.prefijo})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMostrarInfoTipo((prev) => !prev)}
                  title="Ver función operativa del tipo de unidad"
                  aria-label="Ver función operativa del tipo de unidad"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: `1px solid ${mostrarInfoTipo ? '#4361EE' : ui.border}`,
                    backgroundColor: mostrarInfoTipo ? 'rgba(67, 97, 238, 0.12)' : ui.surface,
                    color: mostrarInfoTipo ? '#4361EE' : ui.mutedText,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
              {mostrarInfoTipo && (
                <div style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${ui.border}`,
                  backgroundColor: ui.surface,
                  fontSize: '12.5px',
                  color: ui.text,
                  lineHeight: 1.45,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                    {catalogoSeleccionado.tipo} ({catalogoSeleccionado.prefijo})
                  </div>
                  <div style={{ color: ui.mutedText }}>
                    {catalogoSeleccionado.funcion}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Código de Unidad</label>
              <input
                type="text"
                required
                value={codigoUnidad}
                onChange={(e) => setCodigoUnidad(e.target.value)}
                placeholder="Ej. M-28-1"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Cupo máximo de efectivos</label>
              <input
                type="number"
                min={1}
                max={12}
                required
                value={capacidadMaxima}
                onChange={(e) => setCapacidadMaxima(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setModalUnidadAbierto(false)}
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
                type="submit"
                disabled={procesando}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4361EE',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: procesando ? 'not-allowed' : 'pointer',
                }}
              >
                {procesando ? 'Guardando...' : 'Registrar Unidad'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: + NUEVA CUENTA */}
      {modalCuentaAbierto && (
        <div
          onClick={() => !procesando && setModalCuentaAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCrearCuenta}
            style={{
              width: '460px',
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
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: ui.text }}>
                Nueva Cuenta Operativa
              </h2>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setModalCuentaAbierto(false)}
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
              <label style={labelStyle}>Unidad Asignada</label>
              <select
                required
                value={cuentaUnidadId}
                onChange={(e) => setCuentaUnidadId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar unidad activa</option>
                {unidades
                  .filter((u) => u.activa)
                  .map((u) => {
                    const ocupados = (cuentasPorUnidad[u.id] || []).length;
                    const cap = u.capacidad_maxima ?? 4;
                    const llena = ocupados >= cap;
                    return (
                      <option key={u.id} value={u.id} disabled={llena}>
                        {u.codigo_unidad} - {u.tipo_unidad} ({ocupados}/{cap})
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Nombre Completo</label>
              <input
                type="text"
                required
                value={cuentaNombre}
                onChange={(e) => setCuentaNombre(e.target.value)}
                placeholder="Ej. Bmb. Carlos Ruiz"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Placa de Servicio</label>
                <input
                  type="text"
                  required
                  value={cuentaPlaca}
                  onChange={(e) => setCuentaPlaca(e.target.value)}
                  placeholder="Ej. CGBVP-104"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Correo</label>
                <input
                  type="email"
                  required
                  value={cuentaEmail}
                  onChange={(e) => setCuentaEmail(e.target.value)}
                  placeholder="efectivo@bomberos.pe"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="text"
                required
                value={cuentaPassword}
                onChange={(e) => setCuentaPassword(e.target.value)}
                placeholder="Contraseña de acceso"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setModalCuentaAbierto(false)}
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
                type="submit"
                disabled={procesando || !cuentaUnidadId}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: procesando || !cuentaUnidadId ? ui.border : '#4361EE',
                  color: procesando || !cuentaUnidadId ? ui.mutedText : '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: procesando || !cuentaUnidadId ? 'not-allowed' : 'pointer',
                }}
              >
                {procesando ? 'Guardando...' : 'Registrar Cuenta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDITAR CUENTA */}
      {cuentaEditando && (
        <div
          onClick={() => !procesando && setCuentaEditando(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleGuardarEdicionCuenta}
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
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: ui.text }}>
                Editar Cuenta Operativa
              </h2>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setCuentaEditando(null)}
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
              <label style={labelStyle}>Nombre Completo</label>
              <input
                type="text"
                required
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Placa de Servicio</label>
                <input
                  type="text"
                  required
                  value={editPlaca}
                  onChange={(e) => setEditPlaca(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Correo</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="text"
                required
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editActivo}
                onChange={(e) => setEditActivo(e.target.checked)}
              />
              Cuenta activa
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setCuentaEditando(null)}
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
                type="submit"
                disabled={procesando}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4361EE',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: procesando ? 'not-allowed' : 'pointer',
                }}
              >
                {procesando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
