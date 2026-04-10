import { Button } from "@/components/ui/button"
import { Video, Sparkles, FileVideo, Users, Plus } from "lucide-react"
import Link from "next/link"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar - Ultra-Compact Rail */}
      <aside className="w-12 flex-shrink-0 border-r border-border bg-card/60 backdrop-blur-2xl flex flex-col justify-between hidden md:flex transition-all duration-300 z-20">
        <div className="p-2">
          <Link href="/" className="flex items-center justify-center mb-6 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-[#5c2d91] flex items-center justify-center shadow-[0_0_20px_rgba(92,45,145,0.4)] shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </Link>
          
          <nav className="space-y-3">
            {[
              { href: '/projects', icon: Video },
              { href: '/templates', icon: FileVideo },
              { href: '/agents', icon: Users },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" className="w-full text-foreground/40 hover:text-primary hover:bg-primary/10 px-0 justify-center h-8 transition-colors">
                  <item.icon className="w-4 h-4" />
                </Button>
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-border">
              <Link href="/projects/new?fresh=1">
                <Button className="w-full shadow-[0_0_15px_rgba(34,211,238,0.2)] bg-primary/10 hover:bg-primary text-primary hover:text-background border border-primary/20 px-0 justify-center h-8 overflow-hidden transition-all">
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Abyss Atmospheric Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[150px] pointer-events-none abyss-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto z-10 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  )
}
