import { type BadgeDefinition, BADGE_CATEGORY_COLORS, BADGE_TIER_BORDER } from "@/lib/badges";
import { Lock } from "lucide-react";

interface HexBadgeProps {
  badge: BadgeDefinition;
  unlocked: boolean;
  size?: number;
  progress?: string; // e.g. "37/50"
}

export default function HexBadge({ badge, unlocked, size = 80, progress }: HexBadgeProps) {
  const colors = BADGE_CATEGORY_COLORS[badge.category];
  const tierColor = BADGE_TIER_BORDER[badge.tier];
  const scale = size / 80;
  
  // Hex points for a flat-top hexagon
  const hexPath = "M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z";
  const innerHexPath = "M40 8 L68 24 L68 56 L40 72 L12 56 L12 24 Z";

  const displayValue = badge.threshold >= 1000 
    ? `${(badge.threshold / 1000).toFixed(badge.threshold % 1000 === 0 ? 0 : 1)}k`
    : String(badge.threshold);

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size + 12 * scale }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        className={`drop-shadow-md transition-all duration-300 ${!unlocked ? "grayscale opacity-40" : ""}`}
      >
        {/* Outer border (tier color) */}
        <path
          d={hexPath}
          fill={unlocked ? tierColor : "hsl(0, 0%, 70%)"}
          stroke="white"
          strokeWidth="2.5"
        />
        {/* Inner fill (category color) */}
        <path
          d={innerHexPath}
          fill={unlocked ? colors.bg : "hsl(0, 0%, 82%)"}
        />
        
        {unlocked ? (
          <>
            {/* Number */}
            <text
              x="40"
              y="38"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={colors.text}
              fontSize="20"
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
            >
              {displayValue}
            </text>
            {/* Unit */}
            {badge.thresholdUnit && (
              <text
                x="40"
                y="54"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize="10"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                opacity="0.85"
              >
                {badge.thresholdUnit}
              </text>
            )}
          </>
        ) : (
          <foreignObject x="28" y="28" width="24" height="24">
            <div className="flex items-center justify-center w-full h-full">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
          </foreignObject>
        )}

        {/* Gold shimmer for gold tier unlocked */}
        {unlocked && badge.tier === "gold" && (
          <path
            d={innerHexPath}
            fill="url(#goldShimmer)"
            opacity="0.3"
          >
            <animate
              attributeName="opacity"
              values="0.1;0.35;0.1"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
        )}

        <defs>
          <linearGradient id="goldShimmer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" />
            <stop offset="50%" stopColor="hsl(45, 90%, 70%)" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
        </defs>
      </svg>

      {/* Progress text for locked badges */}
      {!unlocked && progress && (
        <span className="text-[9px] text-muted-foreground font-medium tabular-nums mt-0.5">
          {progress}
        </span>
      )}
    </div>
  );
}
