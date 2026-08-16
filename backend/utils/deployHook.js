/**
 * Triggers a deploy of the frontend on Render to rebuild the Static Site (SSG).
 * It will send a POST request to the deploy hook URL configured in RENDER_FRONTEND_DEPLOY_HOOK.
 */
export const triggerFrontendDeploy = async () => {
  const hookUrl = process.env.RENDER_FRONTEND_DEPLOY_HOOK;
  if (!hookUrl) return;

  try {
    const response = await fetch(hookUrl, { method: 'POST' });
    if (!response.ok) {
      console.error("[DeployHook] Failed to trigger frontend deploy hook, status:", response.status);
    } else {
      console.log("[DeployHook] Successfully triggered frontend deploy hook.");
    }
  } catch (error) {
    console.error("[DeployHook] Error triggering frontend deploy hook:", error);
  }
};
