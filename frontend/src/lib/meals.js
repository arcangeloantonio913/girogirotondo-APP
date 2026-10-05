/**
 * Sceglie il menu da mostrare al genitore tra quelli restituiti da GET /meals.
 * Priorità: menu della classe del bambino → menu universale della sede → qualsiasi altro.
 * Stessa logica di mobile/src/lib/meals.ts (app iOS/Android): web e app DEVONO mostrare lo stesso menu.
 */
export function pickMealForClass(list, classId) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return (
    (classId && list.find(m => m?.class_id === classId)) ||
    list.find(m => !m?.class_id) ||
    list[0] ||
    null
  );
}
