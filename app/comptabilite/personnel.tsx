'use client'

import PersonnelPanel from '../../src/components/PersonnelPanel'

// Wrapper fin — embarqué dans l'onglet « Personnel » de app/comptabilite/page.tsx.
// Le contrôle RBAC (accès au module `personnel`) est géré par le parent
// (app/comptabilite/page.tsx), qui masque cet onglet si l'utilisateur n'a pas
// la permission `personnel`. Ce composant ne doit donc pas ré-effectuer de
// vérification RBAC avec redirection plein écran.
export default function Personnel({ currentUserProfile }: { currentUserProfile?: any }) {
  return <PersonnelPanel currentUserProfile={currentUserProfile} />
}
