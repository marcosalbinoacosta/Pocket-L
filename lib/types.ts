export type Estado = "pendiente" | "contactado" | "no_interesado";

export type Continente = "Africa" | "America" | "Asia" | "Europa" | "Oceania";

export interface Pais {
  id: string;
  nombre: string;
  continente: string | null;
  idioma_oficial: string | null;
  organizacion_notarial: string | null;
  miembro_desde: number | null;
  cantidad_notarios: number | null;
  cantidad_habitantes: number | null;
  consumo_anual: number | null;
  foja_tipo: string | null;
  impresor_fojas: string | null;
  caracteristicas_tecnicas: string | null;
  consejo_emisor_fojas: boolean | null;
  notas_comerciales: string | null;
}

export interface Comision {
  codigo: string;
  nombre: string;
  tipo: "comision" | "grupo_trabajo" | "consejo" | "asamblea";
}

export interface Participante {
  id: string;
  nombre_completo: string;
  pais_id: string | null;
  pais_label: string | null;
  continente: string | null;
  email: string | null;
  telefono: string | null;
  organizacion: string | null;
  cargo_principal: string | null;
  roles_raw: string | null;
  prioridad_score: number;
  foto_url: string | null;
  notas_publicas: string | null;
  created_at: string;
}

export interface Participacion {
  id: string;
  participante_id: string;
  comision_codigo: string;
  cargo: string | null;
}

export interface Representante {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

export interface Contacto {
  id: string;
  participante_id: string;
  estado: Estado;
  alta_prioridad: boolean;
  representante_id: string | null;
  updated_at: string;
}

export interface Nota {
  id: string;
  participante_id: string;
  representante_id: string;
  texto: string;
  created_at: string;
}

// JOIN típico para listas
export interface ParticipanteConEstado extends Participante {
  contacto: Pick<Contacto, "estado" | "alta_prioridad" | "updated_at" | "representante_id"> | null;
}

// =============================================================================
// F.0024-02 · Contactos de stand
// =============================================================================
export type SistemaEmision = "fisico" | "digital" | "mixto";
export type ModalidadCompra = "compra_directa" | "licitacion_publica" | "otro";
export type ImpresorTipo = "estatal" | "privada" | "mixto";
export type DesarrolloTipo = "propio" | "externo";
export type ProximoPaso = "reunion_virtual" | "visita_presencial" | "cotizacion" | "info";
export type CanalContacto = "whatsapp" | "linkedin" | "email" | "telefono";

export interface StandContacto {
  id: string;
  participante_id: string | null;
  institucion: string | null;
  contacto_nombre: string;
  cargo: string | null;
  pais_id: string | null;
  pais_label: string | null;
  email: string | null;
  telefono: string | null;

  p1_notarios_aprox: number | null;
  p2_emite_formularios: boolean | null;
  p3_lineas_formularios: number | null;
  p4_sistema_emision: SistemaEmision | null;

  p5_falsificaciones: boolean | null;
  p6_riesgos: string | null;

  p7_seguridad_fisica: string | null;
  p8_consumo_folios: string | null;
  p9_modalidad_compra: ModalidadCompra | null;
  p10_impresor: ImpresorTipo | null;
  p11_proveedor_impresion: string | null;

  p12_seguridad_digital: string | null;
  p13_herramientas: string | null;
  p14_desarrollo: DesarrolloTipo | null;
  p14_proveedor_desarrollo: string | null;

  p15_proximos_pasos: ProximoPaso[];
  p16_canal_contacto: CanalContacto[];

  observaciones: string | null;
  recepcionado_por: string | null;
  fecha: string;
  tarjeta_url: string | null;

  created_at: string;
  updated_at: string;
}
