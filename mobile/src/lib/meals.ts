/**
 * Sceglie il menu da mostrare al genitore tra quelli restituiti da GET /meals.
 * Priorità: menu della classe del bambino → menu universale della sede → qualsiasi altro.
 * Stessa logica di frontend/src/lib/meals.js (web): app e link web DEVONO mostrare lo stesso menu.
 */
export function pickMealForClass(list: any[] | null | undefined, classId?: string | null): any | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const universal = list.find(m => !m?.class_id) || null;
  if (classId) {
    // Menu della classe del bambino → altrimenti universale di sede. MAI quello di
    // un'altra classe: senza questo guard un genitore poteva vedere il menu sbagliato.
    return list.find(m => m?.class_id === classId) || universal;
  }
  // Classe non nota → solo universale di sede, non indoviniamo una classe a caso.
  return universal;
}
