export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-primary">
          educaplus
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
          AI-powered learning platform — cyberpunk edition
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <span className="inline-flex items-center px-4 py-2 rounded border border-primary text-primary text-sm font-mono">
            {'>'} system.boot()
          </span>
        </div>
      </div>
    </main>
  );
}
