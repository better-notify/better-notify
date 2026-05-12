export function VelozLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#FF4D00" />
      <g transform="translate(3.8, 23.2) scale(0.021, -0.021)">
        <path d="M408 0 20 640H302L633 25H531L862 640H1140L756 0Z" fill="#fff" />
      </g>
    </svg>
  );
}
