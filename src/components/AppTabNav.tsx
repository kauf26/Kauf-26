import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/listings", label: "Published Products" },
  { href: "/sold-products", label: "Sold Products" },
  { href: "/sales", label: "Sales" },
  { href: "/tools", label: "Tools" },
] as const;

export default function AppTabNav() {
  const [location] = useLocation();

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-border pb-3"
      aria-label="Dashboard sections"
    >
      {TABS.map((tab) => {
        const active =
          location === tab.href ||
          (tab.href !== "/dashboard" && location.startsWith(`${tab.href}/`));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
