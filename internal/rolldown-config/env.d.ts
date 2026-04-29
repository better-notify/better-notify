export {};

declare global {
  const process: {
    env: {
      BUNDLE_ANALYZE?: string;
    };
  };
}
