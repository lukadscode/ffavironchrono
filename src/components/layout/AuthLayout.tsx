import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left side */}
      <div className="hidden md:flex relative flex-col justify-between p-8  overflow-hidden">
        {/* Image de fond */}
        <img
          src="https://www.ffaviron.fr/wp-content/uploads/2025/06/FFAviron-nouveau-site.png"
          alt="Aviron"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Overlay foncé pour améliorer lisibilité */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Contenu texte au-dessus de l’image */}
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white mb-4">
            FFAviron - Système de chronométrage
          </h1>
        </div>

        <blockquote className="relative z-10 text-sm text-white mt-4">
          “Gérez vos événements, participants et chronos efficacement.”
        </blockquote>
      </div>

      {/* Right side */}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
