import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `next dev` would otherwise write an AGENTS.md here; the repo's only agent rules file is CLAUDE.md.
  agentRules: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
