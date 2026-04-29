import { cn } from "@/lib/utils";

export function Badge({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider", className)} {...props}>
      {children}
    </span>
  );
}
