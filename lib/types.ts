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
