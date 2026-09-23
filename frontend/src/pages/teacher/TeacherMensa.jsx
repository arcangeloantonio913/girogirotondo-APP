// Pagina Menù per le MAESTRE — riusa l'editor già completo di AdminMensa.
// È role-agnostica: AppLayout mostra la nav della maestra (da user.role) e gli
// endpoint /meals (GET/POST/DELETE) sono ora abilitati alle maestre, scopati
// automaticamente lato backend sulla LORO sede/classe. Il selettore classe usa
// GET /classes che per la maestra restituisce solo le sue classi.
import AdminMensa from '../admin/AdminMensa';

export default function TeacherMensa() {
  return <AdminMensa />;
}
