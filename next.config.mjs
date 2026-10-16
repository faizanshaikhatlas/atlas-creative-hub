/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fabric.js manages its own <canvas> DOM wrapper imperatively. React Strict
  // Mode's intentional double invocation of effects in development can leave a
  // detached Fabric wrapper behind on remount. Disabling it keeps the dev
  // canvas lifecycle clean; production builds never double-invoke regardless.
  reactStrictMode: false,
  // Don't auto-generate AGENTS.md in the project root.
  agentRules: false,
};

export default nextConfig;
