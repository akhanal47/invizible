import type { JSX } from 'react';

const paths = {
  close: <path d="m6 6 12 12M6 18 18 6" />,
  settings: (
    <>
      <path
        d="m9 3-.7 2.2-2 .9-2.2-.5L2.6 8l1.5 1.7v2.6L2.6 14l1.5 2.5 2.2-.5 2 .9L9 19h3l.7-2.1 2-.9 2.2.5 1.5-2.5-1.5-1.7V9.7L18.4 8l-1.5-2.4-2.2.5-2-.9L12 3Z"
        transform="translate(1.5 1)"
      />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  capture: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
    </>
  ),
  send: <path d="M12 20V4m-7 7 7-7 7 7" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  )
};

export function Icon({
  name,
  size = 22
}: {
  name: keyof typeof paths;
  size?: number;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
