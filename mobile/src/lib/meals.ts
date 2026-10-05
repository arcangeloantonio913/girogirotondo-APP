/**
 * Sceglie il menu da mostrare al genitore tra quelli restituiti da GET /meals.
 * Priorità: menu della classe del bambino → menu universale della sede → qualsiasi altro.
 * Stessa logica di frontend/src/lib/meals.js (web): app e link web DEVONO mostrare lo stesso menu.
 */
export function pickMealForClass(list: any[] | null | undefined, classId?: string | null): any | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return (
    (classId && list.find(m => m?.class_id === classId)) ||
    list.find(m => !m?.class_id) ||
    list[0] ||
    null
  );
}
