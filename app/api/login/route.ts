import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Configuración de Supabase incompleta en el servidor' },
        { status: 500 }
      );
    }

    const { email, password } = await request.json();

    console.log('Intentando login con:', email);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario en la tabla usuarios_dashboard
    const { data: usuario, error } = await supabase
      .from('usuarios_dashboard')
      .select('id, email, nombre, rol, compania_id, password_hash, activo')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      console.log('Error o usuario no encontrado:', error?.message);
      return NextResponse.json(
        { error: 'Email o contraseña incorrectos' },
        { status: 401 }
      );
    }

    if (usuario.activo === false) {
      return NextResponse.json(
        { error: 'Usuario inactivo. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const passwordValida =
      Boolean(usuario.password_hash) &&
      (password === usuario.password_hash ||
        ((password === 'admin123' || password === 'bomberos123') &&
          usuario.password_hash === password));

    if (!passwordValida) {
      return NextResponse.json(
        { error: 'Email o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Login exitoso
    console.log('Login exitoso para:', usuario.nombre);
    return NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        compania_id: usuario.compania_id,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}