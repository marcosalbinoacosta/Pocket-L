import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sb = supabaseService();
  const id = params.id;

  const [pq, pasq, nq, sq] = await Promise.all([
    sb.from("participantes").select("*").eq("id", id).single(),
    sb.from("participaciones")
      .select("cargo, comision:comisiones(codigo,nombre,tipo)")
      .eq("participante_id", id),
    sb.from("notas")
      .select("texto, created_at")
      .eq("participante_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    sb.from("stand_contactos")
      .select("*")
      .eq("participante_id", id)
      .order("fecha", { ascending: false })
  ]);

  if (pq.error || !pq.data) {
    return new Response("Participante no encontrado", { status: 404 });
  }

  const p: any = pq.data;
  let pais: any = null;
  if (p.pais_id) {
    const paq = await sb.from("paises").select("*").eq("id", p.pais_id).single();
    if (paq.data) pais = paq.data;
  }

  const participaciones = (pasq.data ?? []).map((r: any) => {
    const c = Array.isArray(r.comision) ? r.comision[0] : r.comision;
    return c ? { cargo: r.cargo ?? "Miembro", organismo: c.nombre, tipo: c.tipo } : null;
  }).filter(Boolean);

  const stand_diagnosticos = (sq.data ?? []).map((s: any) => ({
    fecha: s.fecha,
    institucion: s.institucion,
    contacto: s.contacto_nombre,
    cargo: s.cargo,
    notarios_aprox: s.p1_notarios_aprox,
    institucion_emite_formularios: s.p2_emite_formularios,
    lineas_formularios: s.p3_lineas_formularios,
    sistema_emision: s.p4_sistema_emision,
    falsificaciones_detectadas: s.p5_falsificaciones,
    riesgos_oportunidades: s.p6_riesgos,
    seguridad_fisica_actual: s.p7_seguridad_fisica,
    consumo_folios: s.p8_consumo_folios,
    modalidad_compra: s.p9_modalidad_compra,
    impresor: s.p10_impresor,
    proveedor_impresion_actual: s.p11_proveedor_impresion,
    seguridad_digital: s.p12_seguridad_digital,
    herramientas_digitales: s.p13_herramientas,
    desarrollo: s.p14_desarrollo,
    proveedor_desarrollo: s.p14_proveedor_desarrollo,
    proximos_pasos_solicitados: s.p15_proximos_pasos,
    canal_contacto_preferido: s.p16_canal_contacto,
    observaciones: s.observaciones
  }));

  const ctx = {
    participante: {
      nombre: p.nombre_completo,
      cargo: p.cargo_principal,
      organizacion: p.organizacion,
      pais: p.pais_label,
      roles: p.roles_raw
    },
    pais: pais && {
      nombre: pais.nombre,
      continente: pais.continente,
      idioma_oficial: pais.idioma_oficial,
      organizacion_notarial: pais.organizacion_notarial,
      miembro_uinl_desde: pais.miembro_desde,
      cantidad_notarios: pais.cantidad_notarios,
      cantidad_habitantes: pais.cantidad_habitantes,
      consumo_anual_fojas: pais.consumo_anual,
      foja_tipo: pais.foja_tipo,
      impresor_fojas: pais.impresor_fojas,
      caracteristicas_tecnicas: pais.caracteristicas_tecnicas,
      consejo_emisor_fojas: pais.consejo_emisor_fojas,
      notas_comerciales: pais.notas_comerciales
    },
    participaciones,
    notas_previas: (nq.data ?? []).map((n: any) => n.texto),
    stand_diagnosticos
  };

  const tieneStand = stand_diagnosticos.length > 0;

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system:
      "Sos asistente de un representante de +LATINA (empresa boliviana de papel de seguridad notarial) " +
      "preparando una reunión en el congreso UINL. " +
      "Tu objetivo: entregar un brief conciso y accionable en español rioplatense, sin relleno. " +
      "El representante necesita 30 segundos de lectura para entender con quién va a hablar y qué decir. " +
      "+LATINA vende fojas de seguridad para escrituras públicas, así que el ángulo comercial relevante es " +
      "el sistema de fojas del país (tipo, impresor, características técnicas) y el volumen de consumo. " +
      "Nunca inventes datos: si algo no está en el contexto, omitilo. " +
      "Cuando en el contexto venga `stand_diagnosticos` (formulario F.0024-02 cargado por el equipo en el stand), " +
      "esa información PRIMA sobre los datos genéricos del país: refleja la realidad declarada por la propia institución. " +
      "Usala para personalizar el ángulo comercial y los próximos pasos.",
    prompt:
      (tieneStand
        ? "Generá un brief de 5 a 6 bullets cortos sobre este contacto, en este orden:\n" +
          "1. **Quién es**: cargo + organización + rol UINL relevante.\n" +
          "2. **Diagnóstico declarado (F.0024-02)**: en 1-2 líneas, lo más comercialmente relevante de lo que dijeron en el stand (sistema actual, impresor, falsificaciones, consumo, seguridad). Priorizá los hechos sobre las opiniones.\n" +
          "3. **Mercado**: tamaño en notarios (preferí el dato del F.0024-02 si difiere del país) y consumo de fojas.\n" +
          "4. **Ángulo de conversación**: 1-2 temas concretos basados en `riesgos_oportunidades`, `proveedor_impresion_actual` o `seguridad_fisica_actual`. Si no hay F.0024-02, usar comisiones UINL.\n" +
          "5. **Próximo paso pedido**: convertí `proximos_pasos_solicitados` y `canal_contacto_preferido` en una acción concreta (ej: \"Mandar cotización por WhatsApp\").\n" +
          "6. **Notas previas del equipo** (sólo si hay): resumir en 1 línea.\n\n"
        : "Generá un brief de 4 a 5 bullets cortos sobre este contacto, en este orden:\n" +
          "1. **Quién es**: cargo + organización + rol relevante en UINL.\n" +
          "2. **Contexto del país**: 1 línea con foja_tipo, impresor y características técnicas. Si hay oportunidad comercial clara (ej: papel sin seguridad, impresor estatal sin proveedor privado), señalala.\n" +
          "3. **Mercado**: tamaño en notarios y consumo anual de fojas, si está disponible.\n" +
          "4. **Ángulo de conversación**: 1-2 temas concretos para iniciar, basados en sus comisiones/consejos UINL.\n" +
          "5. **Notas previas del equipo** (sólo si hay): resumir en 1 línea.\n\n") +
      "Formato: markdown, bullets cortos (máx 2 líneas c/u). Sin saludo, sin cierre, directo al brief.\n\n" +
      "Datos:\n```json\n" + JSON.stringify(ctx, null, 2) + "\n```"
  });

  return result.toTextStreamResponse();
}
