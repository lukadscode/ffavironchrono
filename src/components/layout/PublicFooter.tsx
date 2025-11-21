import { Link } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  Facebook,
  Twitter,
  Mail,
  Phone,
} from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="mt-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-t border-slate-700">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Logo et description */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="https://www.ffaviron.fr/wp-content/uploads/2025/06/FFAviron-nouveau-site.png"
                alt="FFAviron"
                className="h-12 object-contain brightness-0 invert"
              />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Système de chronométrage professionnel pour les compétitions d'aviron. Gestion
              complète des événements, participants et résultats en temps réel.
            </p>
          </div>

          {/* Liens rapides */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-slate-400 hover:text-white transition text-sm flex items-center gap-2"
                >
                  <ArrowRight className="w-3 h-3" />
                  Accueil
                </Link>
              </li>
              <li>
                <Link
                  to="/admin"
                  className="text-slate-400 hover:text-white transition text-sm flex items-center gap-2"
                >
                  <ArrowRight className="w-3 h-3" />
                  Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2">
              <li className="text-slate-400 text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a
                  href="mailto:contact@ffaviron.fr"
                  className="hover:text-white transition"
                >
                  contact@ffaviron.fr
                </a>
              </li>
              <li className="text-slate-400 text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="tel:+33123456789" className="hover:text-white transition">
                  +33 1 23 45 67 89
                </a>
              </li>
            </ul>
          </div>

          {/* Réseaux sociaux */}
          <div>
            <h4 className="font-semibold text-white mb-4">Suivez-nous</h4>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/ffaviron"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-blue-600 flex items-center justify-center transition group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a
                href="https://twitter.com/ffaviron"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-blue-400 flex items-center justify-center transition group"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a
                href="https://www.ffaviron.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-blue-500 flex items-center justify-center transition group"
                aria-label="Site web"
              >
                <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* Séparateur */}
        <div className="border-t border-slate-700 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm text-center md:text-left">
              © {new Date().getFullYear()} FFAviron - Tous droits réservés
            </p>
            <div className="flex gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition">
                Mentions légales
              </a>
              <a href="#" className="hover:text-white transition">
                Politique de confidentialité
              </a>
              <a href="#" className="hover:text-white transition">
                CGU
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}


