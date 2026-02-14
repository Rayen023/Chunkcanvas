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
  /** IDs that should be grayed out and unselectable (e.g. local providers when remote) */
  disabledIds?: Set<string>;
  /** Tooltip shown on hover over disabled options */
  disabledTooltip?: string;
}

export function ProviderSelector({
  options,
  selectedId,
  onSelect,
  className = "",
  disabledIds,
  disabledTooltip = "Requires local setup — clone the repo and run locally to use this provider",
}: ProviderSelectorProps) {
  const singleOption = options.length === 1;
  return (
    <div className={`flex ${singleOption ? "" : "flex-wrap"} gap-2 ${className}`}>
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const isDisabled = disabledIds?.has(option.id) ?? false;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => { if (!isDisabled) onSelect(option.id); }}
            disabled={isDisabled}
            className={`${singleOption ? "w-full" : "flex-1 min-w-[120px]"} relative flex flex-col items-center justify-center gap-1.5 rounded-lg px-3 pt-2.5 pb-4 text-sm font-medium border-2 transition-all duration-200 ${
              isDisabled
                ? "opacity-40 cursor-not-allowed bg-card border-silver-light dark:border-[#333] text-silver-dark grayscale"
                : isSelected
                  ? "bg-sandy text-white border-sandy shadow-md cursor-pointer"
                  : "bg-card text-gunmetal border-silver-light shadow-sm hover:border-sandy hover:shadow-md dark:border-[#333] dark:hover:border-sandy cursor-pointer"
            }`}
            title={isDisabled ? disabledTooltip : option.description}
          >
            <div className="flex items-center gap-2 max-w-full">
              {option.icon && (
                <Image
                  src={option.icon}
                  alt=""
                  width={18}
                  height={18}
                  className={`h-[18px] w-[18px] object-contain shrink-0${isDisabled ? " grayscale" : ""}`}
                />
              )}
              <span className="truncate text-xs sm:text-sm">{option.label}</span>
            </div>
            {option.badge && (
              <span
                className={`absolute bottom-1 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
                  isDisabled
                    ? "text-silver-dark/50"
                    : isSelected
                      ? "bg-white/20 text-white/80"
                      : "text-silver-dark/70 dark:text-[#888]"
                }`}
              >
                {option.badge}
              </span>
            )}
            {isDisabled && (
              <span className="absolute top-1 right-1.5 text-[9px]" title={disabledTooltip}>
                <svg className="h-3 w-3 text-silver-dark/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
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
