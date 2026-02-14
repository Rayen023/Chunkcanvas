import Image from "next/image";
import { ReactNode } from "react";

export interface ProviderOption {
  id: string;
  label: string;
  icon?: string; // path to icon
  description?: string;
  badge?: string; // e.g. "Local", "Cloud"
  requiresApiKey?: boolean;
}

interface ProviderSelectorProps {
  options: ProviderOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function ProviderSelector({
  options,
  selectedId,
  onSelect,
  className = "",
}: ProviderSelectorProps) {
  const singleOption = options.length === 1;
  return (
    <div className={`flex ${singleOption ? "" : "flex-wrap"} gap-2 ${className}`}>
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`${singleOption ? "w-full" : "flex-1 min-w-[120px]"} relative flex flex-col items-center justify-center gap-1.5 rounded-lg px-3 pt-2.5 pb-4 text-sm font-medium border-2 transition-all duration-200 cursor-pointer ${
              isSelected
                ? "bg-sandy text-white border-sandy shadow-md"
                : "bg-card text-gunmetal border-silver-light shadow-sm hover:border-sandy hover:shadow-md dark:border-[#333] dark:hover:border-sandy"
            }`}
            title={option.description}
          >
            <div className="flex items-center gap-2 max-w-full">
              {option.icon && (
                <Image
                  src={option.icon}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain shrink-0"
                />
              )}
              <span className="truncate text-xs sm:text-sm">{option.label}</span>
            </div>
            {option.badge && (
              <span
                className={`absolute bottom-1 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
                  isSelected
                    ? "bg-white/20 text-white/80"
                    : "text-silver-dark/70 dark:text-[#888]"
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ConfigHeaderProps {
  title: string;
  icon?: string;
  description?: string;
  className?: string;
}

export function ConfigHeader({
  title,
  icon,
  description,
  className = "",
}: ConfigHeaderProps) {
  return (
    <div className={`flex flex-col gap-1 mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <Image
            src={icon}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        )}
        <h3 className="text-sm font-semibold text-gunmetal">{title}</h3>
      </div>
      {description && (
        <p className="text-xs text-silver-dark leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

interface ConfigContainerProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
}

export function ConfigContainer({
  children,
  className = "",
  active = false,
}: ConfigContainerProps) {
  return (
    <div
      className={`p-4 bg-transparent rounded-lg border space-y-4 animate-in fade-in slide-in-from-top-1 duration-300 ${
        active ? "border-sandy" : "border-silver-light"
      } ${className}`}
    >
      {children}
    </div>
  );
}
