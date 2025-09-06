import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, Users, Phone, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Chat", icon: MessageCircle },
    { path: "/characters", label: "Characters", icon: Users },
    { path: "/voice", label: "Voice Chat", icon: Phone },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-bg border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            AI Chat Hub
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  "hover:bg-hover-accent hover:shadow-subtle",
                  isActive && "bg-primary text-primary-foreground shadow-glow"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg w-full hover:bg-hover-accent transition-all duration-200">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
};

export default Layout;