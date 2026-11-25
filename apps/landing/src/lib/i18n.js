// Lightweight translations. English is the source; add languages by extending DICT.
import { state } from './store.js';
const DICT = {
  fr: { Home: 'Accueil', Emergency: 'Urgence', Bookings: 'RDV', Pharmacy: 'Pharmacie', Providers: 'Soignants', Profile: 'Profil', Requests: 'Demandes', Patients: 'Patients', Messages: 'Messages', Schedule: 'Agenda', Inventory: 'Stock', Orders: 'Commandes', Tests: 'Analyses', Staff: 'Personnel', Departments: 'Services', Reports: 'Rapports', Today: "Aujourd'hui", Tomorrow: 'Demain', Yesterday: 'Hier', Notifications: 'Notifications', 'Sign In': 'Connexion', 'Create Account': 'Créer un compte', Hello: 'Bonjour', Labs: 'Labos', Donate: 'Dons', Insurance: 'Assurance', Appointments: 'Rendez-vous', Records: 'Dossier', Settings: 'Paramètres', Logout: 'Déconnexion', Trips: 'Courses', POS: 'Caisse', Customers: 'Clients' },
  ha: { Home: 'Gida', Emergency: 'Gaggawa', Bookings: 'Alƙawari', Pharmacy: 'Kantin magani', Providers: 'Masu kula', Profile: 'Bayani', Messages: 'Saƙonni', Today: 'Yau', Tomorrow: 'Gobe', Hello: 'Sannu', 'Sign In': 'Shiga', Logout: 'Fita' },
  yo: { Home: 'Ilé', Emergency: 'Pajawiri', Bookings: 'Ìpàdé', Pharmacy: 'Ilé oògùn', Providers: 'Olùtọ́jú', Profile: 'Profaili', Messages: 'Ìfiránṣẹ́', Today: 'Òní', Tomorrow: 'Ọ̀la', Hello: 'Báwo', 'Sign In': 'Wọlé', Logout: 'Jáde' },
  ig: { Home: 'Ụlọ', Emergency: 'Mberede', Bookings: 'Nhọpụta', Pharmacy: 'Ụlọ ọgwụ', Providers: 'Ndị nlekọta', Profile: 'Profaịlụ', Messages: 'Ozi', Today: 'Taa', Tomorrow: 'Echi', Hello: 'Ndewo', 'Sign In': 'Banye', Logout: 'Pụọ' },
};
export const LANGS = [['en', 'English'], ['fr', 'Français'], ['ha', 'Hausa'], ['yo', 'Yorùbá'], ['ig', 'Igbo']];
export function t(s) {
  const l = (state.user?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en').slice(0, 2);
  return DICT[l]?.[s] || s;
}
