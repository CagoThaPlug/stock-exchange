"use client";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 supports-[backdrop-filter]:bg-background/60 backdrop-blur">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">Powered by</span>
            <a
              href="https://zalc.dev"
              target="_blank"
              rel="noreferrer"
              className="font-semibold hover:text-foreground transition-colors"
            >
              Zalc.Dev
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2025 Zalc.Dev. Educational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}