// ─── Constantes globales Moovenco ────────────────────────────────────────────

export const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
export const DELETE_PASSWORD = '1968A'

export const RGO = {
  nom:     'SAS RGO Mobilités Janzé',
  adresse: '57 rue de Bain',
  cp:      '35150',
  ville:   'JANZÉ',
  siret:   '699 200 788 00072',
  naf:     '4939A',
  tva_num: 'FR76699200788',
  rib:     'FR76 1659 8000 0102 6454 9000 136',
  email:   'contact@rgomobilites.fr',
  tel:     '02 99 47 XX XX',
}

export const TVA_TAUX = [0, 10, 20]
export const TYPE_VEHICULE = ['autocar', 'minibus']
export const TYPE_CLIENT   = ['mairie', 'ecole', 'entreprise', 'particulier']

export const TARIF_MODE = [
  { key: 'km',          label: 'Au kilomètre' },
  { key: 'journee',     label: 'À la journée' },
  { key: 'multi_jours', label: 'Multi-jours'  },
]

export const STATUTS_DOC: Record<string, { label: string; color: string; bg: string }> = {
  devis:   { label: 'Devis',   color: '#7B3FB5', bg: '#F3E8FF' },
  signe:   { label: 'Signé',   color: '#D4720A', bg: '#FFF3E0' },
  bc:      { label: 'BC émis', color: '#1565C0', bg: '#E3F2FD' },
  emise:   { label: 'Émise',   color: '#1565C0', bg: '#E3F2FD' },
  envoyee: { label: 'Envoyée', color: '#D4720A', bg: '#FFF3E0' },
  payee:   { label: 'Payée',   color: '#1A9E50', bg: '#E8F5E9' },
  annulee: { label: 'Annulée', color: '#C62828', bg: '#FFEBEE' },
}

export const EMPTY_FORM_DEVIS = {
  type_document: 'devis',
  client_id: '', client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
  client_email: '', client_siret: '', client_type: 'mairie',
  client_contact_nom: '', client_contact_tel: '',
  date_facture: new Date().toISOString().split('T')[0],
  date_service: '', date_echeance: '',
  tva_taux: 10, tarif_mode: 'km', vehicle_type: 'autocar',
  distance_km: '', tarif_km: '', tarif_journee: '',
  nb_jours: 1, frais_attente: 0,
  bc_reference: '', notes: '',
  destination: '', origin: '', date_retour: '',
  passengers: '', vehicule_plaque: '', vehicule_places: '', places_prevues: '',
  heure_depart_garage: '', heure_prise_charge: '', heure_depart: '',
  heure_retour: '', heure_retour_garage: '',
  lieu_prise_charge: '', lieu_depose: '',
  assigned_driver: '', conducteur_nom: '', conducteur_prenom: '',
}
