import { MobileSidebar } from "./MobileSidebar";

interface HeaderProps {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

export function Header({ activeSection = "overview", onSectionChange = () => {} }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-header text-header-foreground px-4 md:px-8 h-[76px] flex items-center border-b border-border shadow-sm">
      <div className="flex items-center gap-3">
        <MobileSidebar 
          activeSection={activeSection} 
          onSectionChange={onSectionChange} 
        />
      </div>
    </header>
  );
}
