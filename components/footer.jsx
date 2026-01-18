"use client";

import React from "react";
import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-800 border-t border-slate-700 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center space-x-2 text-slate-400">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-red-500 fill-current animate-pulse" />
            <span>by</span>
            <span className="text-purple-400 font-semibold">Pratik</span>
          </div>
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} AI Content Platform. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}